import { pgTable, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { people } from './people.js';
import { programs } from './programs.js';
import { enrollments } from './programs.js';

/**
 * Payments table - tracks payment records
 * Links to people, programs, and optionally enrollments
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull().references(() => people.id),
  programId: uuid('program_id').references(() => programs.id),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id),

  // Payment details
  amount: integer('amount').notNull(), // Amount in cents/smallest currency unit
  currency: text('currency').default('ILS'),
  description: text('description'),

  // Status tracking
  status: text('status').$type<'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'>().default('pending'),

  // External payment provider info
  provider: text('provider'), // 'meshulam', 'stripe', 'paypal', etc.
  externalId: text('external_id'), // Transaction ID from payment provider
  externalData: jsonb('external_data').$type<Record<string, unknown>>(),

  // Payment method info
  paymentMethod: text('payment_method'), // 'credit_card', 'bank_transfer', 'cash', etc.

  // Timestamps
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('payments_org_idx').on(table.organizationId),
  index('payments_person_idx').on(table.personId),
  index('payments_program_idx').on(table.programId),
  index('payments_enrollment_idx').on(table.enrollmentId),
  index('payments_status_idx').on(table.status),
]);
