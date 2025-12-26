// Run Hebrew seed SQL against Supabase
// Usage: cd /Users/yaronkra/Jarvis/projects/hkf-crm && node test-data/run_seed_hebrew.mjs

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
const seedSql = readFileSync(join(__dirname, 'seed_100_test_people_hebrew.sql'), 'utf8');

console.log('🇮🇱 Creating 100 test people with Hebrew data...');
console.log('');

try {
  await sql.unsafe(seedSql);

  // Verify creation
  const [count] = await sql`SELECT COUNT(*) as count FROM people WHERE 'TEST_DATA' = ANY(tags)`;
  console.log(`✅ Created ${count.count} test people with Hebrew data.`);

  // Show sample
  const samples = await sql`
    SELECT first_name, last_name, metadata->>'city' as city, metadata->>'occupation' as occupation
    FROM people
    WHERE 'TEST_DATA' = ANY(tags)
    LIMIT 5
  `;
  console.log('\nSample data:');
  samples.forEach(s => {
    console.log(`  ${s.first_name} ${s.last_name} - ${s.city || 'N/A'}, ${s.occupation || 'N/A'}`);
  });

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
