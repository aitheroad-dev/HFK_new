import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Programs table - courses, tracks, memberships
 * Configurable per tenant - no hardcoded program types
 */
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  name: text('name').notNull(),
  description: text('description'),
  type: text('type'), // tenant-defined: 'course', 'membership', 'track', etc.

  // Configuration
  config: jsonb('config').$type<{
    requiresInterview?: boolean;
    requiresPayment?: boolean;
    paymentAmount?: number;
    currency?: string;
    maxParticipants?: number;
    applicationFields?: Array<{
      name: string;
      type: 'text' | 'email' | 'phone' | 'select' | 'date';
      required: boolean;
      options?: string[];
    }>;
  }>().default({}),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('programs_org_idx').on(table.organizationId),
]);

/**
 * Cohorts - groups within programs (e.g., "Class of 2025")
 */
export const cohorts = pgTable('cohorts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  programId: uuid('program_id').notNull().references(() => programs.id),

  name: text('name').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  maxParticipants: integer('max_participants'),

  status: text('status').$type<'draft' | 'open' | 'closed' | 'completed'>().default('draft'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('cohorts_org_idx').on(table.organizationId),
  index('cohorts_program_idx').on(table.programId),
]);

/**
 * Enrollments - links people to programs/cohorts
 */
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull(),
  programId: uuid('program_id').notNull().references(() => programs.id),
  cohortId: uuid('cohort_id').references(() => cohorts.id),

  status: text('status').$type<'applied' | 'interviewing' | 'accepted' | 'rejected' | 'enrolled' | 'completed' | 'dropped'>().default('applied'),

  // Application data (answers to program-specific questions)
  applicationData: jsonb('application_data').$type<Record<string, unknown>>().default({}),

  appliedAt: timestamp('applied_at').defaultNow(),
  enrolledAt: timestamp('enrolled_at'),
  completedAt: timestamp('completed_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('enrollments_org_idx').on(table.organizationId),
  index('enrollments_person_idx').on(table.personId),
  index('enrollments_program_idx').on(table.programId),
]);
