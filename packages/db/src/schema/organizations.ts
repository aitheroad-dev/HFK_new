import { pgTable, uuid, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * Organizations table - multi-tenant foundation
 * Every other table references this via organization_id
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),

  // Configuration stored as JSON for flexibility
  config: jsonb('config').$type<{
    language?: 'en' | 'he' | 'es';
    timezone?: string;
    customInstructions?: string;
    branding?: {
      logo?: string;
      primaryColor?: string;
      name?: string;
    };
    features?: {
      payments?: boolean;
      whatsapp?: boolean;
      interviews?: boolean;
    };
  }>().default({}),

  // Integration credentials (encrypted in production)
  integrations: jsonb('integrations').$type<{
    payment?: {
      provider: 'meshulam' | 'stripe' | 'paypal';
      credentials: Record<string, string>;
    };
    messaging?: {
      provider: 'naamabot' | 'twilio' | 'whatsapp_api';
      credentials: Record<string, string>;
    };
    email?: {
      provider: 'brevo' | 'sendgrid' | 'mailgun';
      credentials: Record<string, string>;
    };
  }>().default({}),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
