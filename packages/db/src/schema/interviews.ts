import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { people } from './people.js';
import { programs } from './programs.js';
import { enrollments } from './programs.js';

/**
 * Interviews table - scheduled interview appointments
 * Links to enrollments to track interview status in application flow
 */
export const interviews = pgTable('interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull().references(() => people.id),
  programId: uuid('program_id').notNull().references(() => programs.id),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id),

  // Scheduling
  scheduledAt: timestamp('scheduled_at').notNull(),
  durationMinutes: text('duration_minutes').default('30'),
  location: text('location'), // "Zoom", "Phone", "In-person", or URL

  // Status tracking
  status: text('status').$type<'scheduled' | 'completed' | 'cancelled' | 'no_show'>().default('scheduled'),

  // Outcome (filled after interview)
  outcome: text('outcome').$type<'passed' | 'failed' | 'pending_decision' | null>(),
  notes: text('notes'),
  interviewerNotes: jsonb('interviewer_notes').$type<{
    strengths?: string[];
    concerns?: string[];
    recommendation?: string;
    score?: number;
  }>(),

  // Metadata
  createdBy: uuid('created_by'), // Who scheduled the interview
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('interviews_org_idx').on(table.organizationId),
  index('interviews_person_idx').on(table.personId),
  index('interviews_program_idx').on(table.programId),
  index('interviews_enrollment_idx').on(table.enrollmentId),
  index('interviews_scheduled_idx').on(table.scheduledAt),
]);
