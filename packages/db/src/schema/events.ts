import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

/**
 * Events table - meetings, workshops, gatherings
 * Multi-tenant: all queries must filter by organization_id
 */
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Event details
  name: text('name').notNull(),
  description: text('description'),
  type: text('type'), // tenant-defined: 'workshop', 'meeting', 'webinar', etc.

  // Timing
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at'),
  timezone: text('timezone').default('Asia/Jerusalem'),

  // Location
  location: text('location'), // physical address or "online"
  locationUrl: text('location_url'), // Zoom link, Google Meet, etc.

  // Capacity
  capacity: integer('capacity'),
  registrationCount: integer('registration_count').default(0),

  // Targeting - who should be invited
  targetAudience: jsonb('target_audience').$type<{
    programIds?: string[];
    cohortIds?: string[];
    statuses?: string[];
    tags?: string[];
  }>().default({}),

  // Status
  status: text('status').$type<'draft' | 'published' | 'cancelled' | 'completed'>().default('draft'),

  // Metadata for additional fields
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('events_org_idx').on(table.organizationId),
  index('events_starts_at_idx').on(table.startsAt),
  index('events_status_idx').on(table.organizationId, table.status),
]);

/**
 * Event registrations - links people to events
 */
export const eventRegistrations = pgTable('event_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  eventId: uuid('event_id').notNull().references(() => events.id),
  personId: uuid('person_id').notNull(),

  // Registration details
  status: text('status').$type<'registered' | 'cancelled' | 'waitlisted' | 'attended' | 'no_show'>().default('registered'),
  guests: integer('guests').default(0), // additional guests

  // Check-in tracking
  checkedInAt: timestamp('checked_in_at'),

  // Notes
  notes: text('notes'),

  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('event_registrations_org_idx').on(table.organizationId),
  index('event_registrations_event_idx').on(table.eventId),
  index('event_registrations_person_idx').on(table.personId),
]);
