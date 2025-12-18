import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Escalations table - situations flagged for human review
 * Used by the AI to hand off complex cases to staff
 */
export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // What triggered the escalation
  reason: text('reason').notNull(),
  urgency: text('urgency').$type<'low' | 'medium' | 'high' | 'critical'>().default('medium'),

  // Related entities
  personId: uuid('person_id'), // optional - person involved
  enrollmentId: uuid('enrollment_id'), // optional - related enrollment
  interviewId: uuid('interview_id'), // optional - related interview

  // Context for the human reviewer
  context: jsonb('context').$type<{
    lastMessage?: string;
    conversationSummary?: string;
    actionsTaken?: string[];
    suggestedActions?: string[];
    relatedData?: Record<string, unknown>;
  }>().default({}),

  // Assignment
  assignedTo: uuid('assigned_to'), // staff member UUID
  assignedAt: timestamp('assigned_at'),

  // Resolution
  status: text('status').$type<'open' | 'in_progress' | 'resolved' | 'dismissed'>().default('open'),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),

  // Source - where the escalation came from
  source: text('source').$type<'ai_agent' | 'webhook' | 'manual' | 'system'>().default('ai_agent'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('escalations_org_idx').on(table.organizationId),
  index('escalations_status_idx').on(table.organizationId, table.status),
  index('escalations_urgency_idx').on(table.organizationId, table.urgency),
  index('escalations_person_idx').on(table.personId),
]);

/**
 * Communications log - track all messages sent/received
 */
export const communications = pgTable('communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull(),

  // Channel and direction
  channel: text('channel').$type<'email' | 'whatsapp' | 'sms' | 'phone' | 'in_app'>().notNull(),
  direction: text('direction').$type<'inbound' | 'outbound'>().notNull(),

  // Content
  subject: text('subject'), // for emails
  message: text('message').notNull(),
  templateId: text('template_id'), // if sent from template

  // Status
  status: text('status').$type<'queued' | 'sent' | 'delivered' | 'failed' | 'bounced'>().default('queued'),
  externalId: text('external_id'), // message ID from provider

  // Metadata
  metadata: jsonb('metadata').$type<{
    provider?: string;
    errorMessage?: string;
    deliveredAt?: string;
    readAt?: string;
  }>().default({}),

  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('communications_org_idx').on(table.organizationId),
  index('communications_person_idx').on(table.personId),
  index('communications_channel_idx').on(table.channel),
]);
