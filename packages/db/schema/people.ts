import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

/**
 * People table - contacts, participants, members
 * Multi-tenant: all queries must filter by organization_id
 */
export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Basic info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),

  // Status in the system
  status: text('status').$type<'active' | 'inactive' | 'pending' | 'archived'>().default('pending'),

  // Flexible metadata for tenant-specific fields
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

  // Tags for categorization
  tags: text('tags').array().default([]),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('people_org_idx').on(table.organizationId),
  index('people_email_idx').on(table.email),
  index('people_status_idx').on(table.organizationId, table.status),
]);
