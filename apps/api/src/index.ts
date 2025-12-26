import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { sessionManager, type ChatResponse, type UserInfo } from './ai/agent.js';
import { requireAuth, verifyWebSocketToken, type AuthUser } from './auth.js';
import { sendEmail, checkEmailStatus } from './integrations/email.js';

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

// ============================================================
// EMAIL TEST ENDPOINTS (for debugging Brevo integration)
// ============================================================

// Check Brevo configuration status
fastify.get('/test/email-status', async () => {
  const result = await checkEmailStatus();
  return {
    timestamp: new Date().toISOString(),
    brevoConfigured: result.configured,
    authenticated: result.authenticated,
    senderEmail: result.senderEmail,
    senderName: result.senderName,
    message: result.message,
    envVars: {
      BREVO_API_KEY: process.env.BREVO_API_KEY ? '✅ Set' : '❌ Missing',
      BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || '❌ Missing',
      BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || '❌ Missing',
    }
  };
});

// Send a test email directly (bypass JARVIS)
fastify.get<{ Querystring: { to?: string } }>('/test/send-email', async (request, reply) => {
  const to = request.query.to;

  if (!to) {
    return reply.status(400).send({
      error: 'Missing "to" parameter',
      usage: '/test/send-email?to=your@email.com'
    });
  }

  console.log(`[TEST] Attempting to send test email to: ${to}`);

  try {
    const result = await sendEmail({
      to: [{ email: to, name: 'Test Recipient' }],
      subject: 'HKF CRM Test Email',
      htmlContent: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>בדיקת מערכת</h2>
          <p>זוהי הודעת בדיקה מ-HKF CRM.</p>
          <p>אם קיבלת הודעה זו, אינטגרציית Brevo עובדת!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            Environment: ${process.env.NODE_ENV || 'development'}
          </p>
        </div>
      `,
      textContent: 'בדיקת מערכת - זוהי הודעת בדיקה מ-HKF CRM.',
      tags: ['test', 'debug'],
    });

    console.log(`[TEST] Email result:`, result);

    return {
      success: result.success,
      messageId: result.messageId,
      to,
      timestamp: new Date().toISOString(),
      details: result,
    };
  } catch (error) {
    console.error(`[TEST] Email error:`, error);
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Test search endpoint to debug search_people issues
fastify.get<{ Querystring: { q?: string } }>('/test/search', async (request, reply) => {
  const query = request.query.q || '';
  const HKF_ORG = process.env.HKF_ORG_ID || '';

  console.log(`[TEST SEARCH] query="${query}", orgId="${HKF_ORG}"`);

  // Import db from tools.ts to use the same search logic
  // For now, do a direct Supabase query
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // First get all people to see what's in the DB
  const { data: allPeople, error: allError } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, organization_id')
    .eq('organization_id', HKF_ORG)
    .limit(20);

  if (allError) {
    return reply.status(500).send({ error: allError.message });
  }

  // Now try the search
  const searchPattern = `%${query}%`;
  const queryParts = query.trim().split(/\s+/);

  let searchResults: typeof allPeople = [];

  if (query) {
    // Try the concatenated name search like we do in tools.ts
    const { data: nameSearch, error: nameErr } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, organization_id')
      .eq('organization_id', HKF_ORG)
      .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`);

    if (!nameErr) searchResults = nameSearch || [];

    // Also try matching split parts
    if (queryParts.length >= 2) {
      const { data: splitSearch } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, organization_id')
        .eq('organization_id', HKF_ORG)
        .ilike('first_name', `%${queryParts[0]}%`)
        .ilike('last_name', `%${queryParts[1]}%`);

      if (splitSearch && splitSearch.length > 0) {
        searchResults = [...(searchResults || []), ...splitSearch];
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    query,
    queryParts,
    orgId: HKF_ORG,
    allPeopleInOrg: allPeople,
    searchResults,
  };
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
      content: 'נועם מחובר. איך אפשר לעזור לך היום?',
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
          // Clear and archive the session in database
          if (sessionManager.hasSession(sessionId)) {
            const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID);
            await session.clearHistory();
          }
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
          // Build user info for conversation tracking
          const userInfo: UserInfo = {
            userId: authenticatedUser?.id,
            userEmail: authenticatedUser?.email,
          };

          // Get or create session (single-tenant: always use HKF_ORG_ID)
          const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID, userInfo);

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
      // Build user info from authenticated request
      const userInfo: UserInfo = {
        userId: request.user?.id,
        userEmail: request.user?.email,
      };

      // Single-tenant: always use HKF_ORG_ID
      const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID, userInfo);
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
