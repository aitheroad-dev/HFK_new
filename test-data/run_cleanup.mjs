// Run cleanup SQL against Supabase to remove all test data
// Usage: cd /Users/yaronkra/Jarvis/projects/hkf-crm && node test-data/run_cleanup.mjs

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
const cleanupSql = readFileSync(join(__dirname, 'cleanup_test_data.sql'), 'utf8');

console.log('⚠️  WARNING: This will delete ALL test data (people with TEST_DATA tag)');
console.log('');

// Count current test data before cleanup
const [beforeCount] = await sql`SELECT COUNT(*) as count FROM people WHERE 'TEST_DATA' = ANY(tags)`;
console.log(`Found ${beforeCount.count} test people to delete.`);

if (parseInt(beforeCount.count) === 0) {
  console.log('No test data to clean up.');
  await sql.end();
  process.exit(0);
}

console.log('\nExecuting cleanup...');

try {
  await sql.unsafe(cleanupSql);

  // Verify cleanup
  const [afterCount] = await sql`SELECT COUNT(*) as count FROM people WHERE 'TEST_DATA' = ANY(tags)`;

  if (parseInt(afterCount.count) === 0) {
    console.log('\n✅ Cleanup complete! All test data has been removed.');
  } else {
    console.log(`\n⚠️  ${afterCount.count} test people still remain.`);
  }

} catch (error) {
  console.error('Error executing cleanup:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
