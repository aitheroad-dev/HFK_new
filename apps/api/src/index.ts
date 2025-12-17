import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

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

// WebSocket chat endpoint placeholder
fastify.register(async function (fastify) {
  fastify.get('/chat', { websocket: true }, (socket, req) => {
    socket.on('message', (message) => {
      // TODO: Implement Claude AI chat handler
      socket.send(JSON.stringify({
        type: 'message',
        content: 'JARVIS API connected. AI integration coming soon.'
      }));
    });
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
