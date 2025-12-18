import { db, programs } from '@generic-ai-crm/db';

async function seedTestProgram() {
  console.log('Creating test program...');

  const orgId = '2542c6fe-3707-4dd8-abc5-bc70feac7e81'; // Test Organization from before

  const result = await db.insert(programs).values({
    organizationId: orgId,
    name: 'Leadership Course 2025',
    description: 'An intensive leadership development program for emerging leaders.',
    type: 'course',
    config: {
      requiresInterview: true,
      requiresPayment: true,
      paymentAmount: 500,
      currency: 'USD',
      maxParticipants: 30,
      applicationFields: [
        { name: 'motivation', type: 'text', required: true },
        { name: 'experience', type: 'text', required: true },
      ],
    },
    isActive: true,
  }).returning();

  console.log('Created program:', result[0]);
  console.log('\nProgram ID:', result[0].id);

  process.exit(0);
}

seedTestProgram().catch(console.error);
