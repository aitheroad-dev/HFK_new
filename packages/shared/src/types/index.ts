/**
 * Shared type definitions for Generic AI CRM
 */

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Pagination
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// User context (from auth)
export interface UserContext {
  userId: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  permissions: string[];
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: Array<{
      name: string;
      input: Record<string, unknown>;
      result?: unknown;
    }>;
  };
}

// Webhook event types
export interface WebhookEvent {
  type: string;
  organizationId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  source: 'payment' | 'messaging' | 'email' | 'internal';
}
