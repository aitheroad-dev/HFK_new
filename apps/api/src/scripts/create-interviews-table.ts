import { db } from '@generic-ai-crm/db';
import { sql } from 'drizzle-orm';

async function createInterviewsTable() {
  console.log('Creating interviews table...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      person_id UUID NOT NULL REFERENCES people(id),
      program_id UUID NOT NULL REFERENCES programs(id),
      enrollment_id UUID REFERENCES enrollments(id),
      scheduled_at TIMESTAMP NOT NULL,
      duration_minutes TEXT DEFAULT '30',
      location TEXT,
      status TEXT DEFAULT 'scheduled',
      outcome TEXT,
      notes TEXT,
      interviewer_notes JSONB,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS interviews_org_idx ON interviews(organization_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS interviews_person_idx ON interviews(person_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS interviews_program_idx ON interviews(program_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS interviews_enrollment_idx ON interviews(enrollment_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS interviews_scheduled_idx ON interviews(scheduled_at)`);

  console.log('Interviews table created successfully!');
  process.exit(0);
}

createInterviewsTable().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
