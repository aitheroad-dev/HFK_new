import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL!;

async function applyMigration() {
  const sql = postgres(connectionString);

  const migrationPath = path.join(
    process.cwd(),
    '..',
    '..',
    'supabase',
    'migrations',
    '20251218030000_add_events_escalations.sql'
  );

  console.log('Reading migration from:', migrationPath);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration...');

  try {
    await sql.unsafe(migrationSQL);
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(console.error);
