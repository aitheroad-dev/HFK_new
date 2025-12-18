import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { sessionManager, type ChatResponse } from './ai/agent.js';
import { requireAuth, verifyWebSocketToken, type AuthUser } from './auth.js';

// WebSocket message validation schemas
const WsMessageSchema = z.object({
  type: z.enum(['chat', 'ping', 'clear_history']),
  message: z.string().max(10000).optional(), // Limit message size
  sessionId: z.string().uuid().optional(),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
});

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.WEB_URL || ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
});

await fastify.register(websocket);

// Rate limiting - protect against DOS and brute force
await fastify.register(rateLimit, {
  max: 100, // max 100 requests per window
  timeWindow: '1 minute',
  // Different limits for different routes
  keyGenerator: (request) => {
    // Use user ID if authenticated, otherwise IP
    return request.user?.id || request.ip;
  },
  errorResponseBuilder: (request, context) => {
    return {
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    };
  },
});

// Health check endpoint (no rate limit needed)
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// HKF Organization ID - Single tenant deployment
// SECURITY: No fallback - must be explicitly configured
const HKF_ORG_ID = process.env.HKF_ORG_ID;
if (!HKF_ORG_ID) {
  throw new Error('FATAL: HKF_ORG_ID environment variable is required. Cannot start without organization context.');
}

// WebSocket message type (inferred from Zod schema)
type WsMessage = z.infer<typeof WsMessageSchema>;

interface WsResponse {
  type: 'message' | 'error' | 'pong' | 'tool_use' | 'connected';
  content?: string;
  sessionId?: string;
  toolCalls?: ChatResponse['toolCalls'];
  toolResults?: ChatResponse['toolResults'];
  error?: string;
}

// WebSocket chat endpoint
fastify.register(async function (fastify) {
  fastify.get('/chat', { websocket: true }, async (socket, req) => {
    // Generate or use provided session ID
    let sessionId: string = randomUUID();
    let authenticatedUser: AuthUser | null = null;

    // Send connection confirmation
    const sendResponse = (response: WsResponse) => {
      socket.send(JSON.stringify(response));
    };

    // Check for auth token in query params (ws://host/chat?token=xxx)
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) {
      authenticatedUser = await verifyWebSocketToken(token);
    }

    // In production, require authentication
    if (process.env.NODE_ENV === 'production' && !authenticatedUser) {
      sendResponse({
        type: 'error',
        error: 'Authentication required. Pass token as query parameter.',
      });
      socket.close(4001, 'Unauthorized');
      return;
    }

    sendResponse({
      type: 'connected',
      sessionId,
      content: 'JARVIS connected. How can I help you today?',
    });

    socket.on('message', async (rawMessage) => {
      try {
        // Parse and validate the incoming message
        let parsedData: unknown;
        try {
          parsedData = JSON.parse(rawMessage.toString());
        } catch {
          sendResponse({
            type: 'error',
            error: 'Invalid JSON message',
          });
          return;
        }

        // Validate against schema
        const validationResult = WsMessageSchema.safeParse(parsedData);
        if (!validationResult.success) {
          sendResponse({
            type: 'error',
            error: `Invalid message format: ${validationResult.error.errors.map(e => e.message).join(', ')}`,
          });
          return;
        }

        const data = validationResult.data;

        // Handle ping
        if (data.type === 'ping') {
          sendResponse({ type: 'pong' });
          return;
        }

        // Update session ID if provided
        if (data.sessionId) sessionId = data.sessionId;

        // Handle clear history
        if (data.type === 'clear_history') {
          sessionManager.removeSession(sessionId);
          sendResponse({
            type: 'message',
            sessionId,
            content: 'Conversation history cleared. Starting fresh!',
          });
          return;
        }

        // Handle chat message
        if (data.type === 'chat' && data.message) {
          // Get or create session (single-tenant: always use HKF_ORG_ID)
          const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID);

          // Process message through Claude
          const response = await session.chat(data.message);

          // Send response with tool info if available
          sendResponse({
            type: 'message',
            sessionId,
            content: response.message,
            toolCalls: response.toolCalls,
            toolResults: response.toolResults,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(error, 'WebSocket chat error');
        sendResponse({
          type: 'error',
          sessionId,
          error: errorMessage,
        });
      }
    });

    socket.on('close', () => {
      fastify.log.info({ sessionId }, 'WebSocket connection closed');
      // Optionally keep session for reconnection, or remove it:
      // sessionManager.removeSession(sessionId);
    });
  });
});

// REST API endpoint for chat (alternative to WebSocket)
type ChatRequestBody = z.infer<typeof ChatRequestSchema>;

fastify.post<{ Body: ChatRequestBody }>(
  '/api/chat',
  { preHandler: requireAuth },
  async (request, reply) => {
    // Validate request body with Zod
    const validationResult = ChatRequestSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validationResult.error.errors.map(e => e.message),
      });
    }

    const { message, sessionId = randomUUID() } = validationResult.data;

    try {
      // Single-tenant: always use HKF_ORG_ID
      const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID);
      const response = await session.chat(message);

      return {
        sessionId,
        message: response.message,
        toolCalls: response.toolCalls,
        toolResults: response.toolResults,
        stopReason: response.stopReason,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(error, 'Chat API error');
      return reply.status(500).send({ error: errorMessage });
    }
  }
);

// Clear session endpoint
fastify.delete<{ Params: { sessionId: string } }>(
  '/api/sessions/:sessionId',
  { preHandler: requireAuth },
  async (request, reply) => {
    const { sessionId } = request.params;
    sessionManager.removeSession(sessionId);
    return { success: true, message: 'Session cleared' };
  }
);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 JARVIS API server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
