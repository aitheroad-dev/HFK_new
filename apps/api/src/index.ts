import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { sessionManager, type ChatResponse } from './ai/agent.js';

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.WEB_URL || 'http://localhost:5173',
  credentials: true,
});

await fastify.register(websocket);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// WebSocket message types
interface WsMessage {
  type: 'chat' | 'ping' | 'clear_history';
  message?: string;
  sessionId?: string;
  organizationId?: string;
}

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
  fastify.get('/chat', { websocket: true }, (socket, req) => {
    // Generate or use provided session ID
    let sessionId: string = randomUUID();
    // Default org ID for now - will come from auth later
    let organizationId = process.env.DEFAULT_ORG_ID || 'demo-org';

    // Send connection confirmation
    const sendResponse = (response: WsResponse) => {
      socket.send(JSON.stringify(response));
    };

    sendResponse({
      type: 'connected',
      sessionId,
      content: 'JARVIS connected. How can I help you today?',
    });

    socket.on('message', async (rawMessage) => {
      try {
        const data: WsMessage = JSON.parse(rawMessage.toString());

        // Handle ping
        if (data.type === 'ping') {
          sendResponse({ type: 'pong' });
          return;
        }

        // Update session/org IDs if provided
        if (data.sessionId) sessionId = data.sessionId;
        if (data.organizationId) organizationId = data.organizationId;

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
          // Get or create session
          const session = sessionManager.getOrCreateSession(sessionId, organizationId);

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
interface ChatRequestBody {
  message: string;
  sessionId?: string;
  organizationId?: string;
}

fastify.post<{ Body: ChatRequestBody }>('/api/chat', async (request, reply) => {
  const { message, sessionId = randomUUID(), organizationId = process.env.DEFAULT_ORG_ID || 'demo-org' } = request.body;

  if (!message) {
    return reply.status(400).send({ error: 'Message is required' });
  }

  try {
    const session = sessionManager.getOrCreateSession(sessionId, organizationId);
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
});

// Clear session endpoint
fastify.delete<{ Params: { sessionId: string } }>('/api/sessions/:sessionId', async (request, reply) => {
  const { sessionId } = request.params;
  sessionManager.removeSession(sessionId);
  return { success: true, message: 'Session cleared' };
});

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
