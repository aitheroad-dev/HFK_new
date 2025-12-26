import { pgTable, uuid, text, timestamp, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { people } from './people.js';

/**
 * AI Conversations table - stores conversation sessions with the AI assistant
 * Used for audit trail and session recovery after WebSocket disconnect
 */
export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Session identification
  sessionId: text('session_id').notNull().unique(), // WebSocket session ID

  // User who initiated the conversation
  userId: uuid('user_id'), // Supabase auth user ID
  userEmail: text('user_email'), // For display without join

  // Optional context links
  personId: uuid('person_id').references(() => people.id), // Related person if context-aware

  // Metadata
  title: text('title'), // Auto-generated or user-set summary
  messageCount: integer('message_count').default(0),

  // Status
  status: text('status').$type<'active' | 'archived'>().default('active'),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('ai_conversations_org_idx').on(table.organizationId),
  index('ai_conversations_user_idx').on(table.userId),
  index('ai_conversations_status_idx').on(table.status),
  index('ai_conversations_last_msg_idx').on(table.lastMessageAt),
  index('ai_conversations_session_idx').on(table.sessionId),
]);

/**
 * Tool call structure stored in JSONB
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result structure stored in JSONB
 */
export interface ToolResult {
  toolUseId: string;
  result: unknown;
  isError: boolean;
}

/**
 * AI Conversation Messages table - individual messages in a conversation
 * Stores both user messages and assistant responses with tool call details
 */
export const aiConversationMessages = pgTable('ai_conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),

  // Message content
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content'), // Text content (may be null for tool-only responses)

  // Tool execution details (for assistant messages)
  toolCalls: jsonb('tool_calls').$type<ToolCall[]>(),
  toolResults: jsonb('tool_results').$type<ToolResult[]>(),

  // Metadata
  stopReason: text('stop_reason'), // 'end_turn', 'tool_use', 'max_tokens', etc.
  tokensUsed: integer('tokens_used'), // Optional token tracking

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('ai_messages_conv_idx').on(table.conversationId),
  index('ai_messages_created_idx').on(table.createdAt),
  index('ai_messages_role_idx').on(table.conversationId, table.role),
]);
