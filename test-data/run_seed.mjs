// Run seed SQL against Supabase using postgres package
// Usage: cd apps/api && node ../../test-data/run_seed.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const postgres = require('../apps/api/node_modules/postgres');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = 'postgresql://postgres:nBC6IczzuMfITxCT@db.txjyyvzyahqmjndfsnzx.supabase.co:5432/postgres';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1
});

// Read SQL file
const seedSql = readFileSync(join(__dirname, 'seed_100_test_people.sql'), 'utf8');

console.log('Executing seed SQL...');
console.log('This will create 100 test people with enrollments, interviews, and payments.');

try {
  // Execute the DO block directly
  await sql.unsafe(seedSql);
  console.log('\n✅ Successfully created 100 test people!');

  // Verify counts
  const [peopleCount] = await sql`SELECT COUNT(*) as count FROM people WHERE 'TEST_DATA' = ANY(tags)`;
  const [enrollmentCount] = await sql`SELECT COUNT(*) as count FROM enrollments e JOIN people p ON e.person_id = p.id WHERE 'TEST_DATA' = ANY(p.tags)`;
  const [interviewCount] = await sql`SELECT COUNT(*) as count FROM interviews i JOIN people p ON i.person_id = p.id WHERE 'TEST_DATA' = ANY(p.tags)`;
  const [paymentCount] = await sql`SELECT COUNT(*) as count FROM payments py JOIN people p ON py.person_id = p.id WHERE 'TEST_DATA' = ANY(p.tags)`;

  console.log('\n📊 Created data summary:');
  console.log(`   - People: ${peopleCount.count}`);
  console.log(`   - Enrollments: ${enrollmentCount.count}`);
  console.log(`   - Interviews: ${interviewCount.count}`);
  console.log(`   - Payments: ${paymentCount.count}`);

} catch (error) {
  console.error('Error executing SQL:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
