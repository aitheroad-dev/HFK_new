import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Initialize Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY are required for authentication');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// User info extracted from JWT
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Extract and verify JWT token from Authorization header
 * Returns user info if valid, null if invalid/missing
 */
export async function verifyToken(authHeader: string | undefined): Promise<AuthUser | null> {
  if (!authHeader) {
    return null;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return null;
  }

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Fastify preHandler hook for authentication
 * Use this to protect routes that require authentication
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const user = await verifyToken(authHeader);

  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Valid authentication token required',
    });
  }

  // Attach user to request for use in handlers
  request.user = user;
}

/**
 * Optional auth - attaches user if token present, but doesn't block
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const user = await verifyToken(authHeader);

  if (user) {
    request.user = user;
  }
}

/**
 * Verify WebSocket connection token
 * For WebSocket, token is typically passed as query param or in first message
 */
export async function verifyWebSocketToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  return verifyToken(`Bearer ${token}`);
}
