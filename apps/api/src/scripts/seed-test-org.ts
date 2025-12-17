import { db, organizations } from '@generic-ai-crm/db';

async function seedTestOrg() {
  console.log('Creating test organization...');

  const result = await db.insert(organizations).values({
    name: 'Test Organization',
    slug: 'test-org',
    config: {
      language: 'en',
      timezone: 'UTC',
    },
  }).returning();

  console.log('Created organization:', result[0]);
  console.log('\nOrganization ID to use:', result[0].id);

  process.exit(0);
}

seedTestOrg().catch(console.error);
