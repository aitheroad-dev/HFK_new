/**
 * PIF Alumni Import - DRY RUN (parsing only, no database)
 *
 * Usage:
 *   node scripts/import-pif-dryrun.mjs <csv-file-path>
 */

import { readFileSync } from 'fs';

// ============================================================================
// CSV PARSING (built-in)
// ============================================================================

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ============================================================================
// NAME SPLITTING (Hebrew)
// ============================================================================

function splitName(fullName) {
  const trimmed = fullName.trim();

  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');

  return { firstName, lastName };
}

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

function normalizePhone(phone) {
  if (!phone || !phone.trim()) {
    return null;
  }

  let cleaned = phone.trim();

  // International non-Israeli - keep as-is
  if (cleaned.startsWith('+') && !cleaned.startsWith('+972')) {
    return cleaned;
  }

  // Israeli - normalize to 05XXXXXXXX
  cleaned = cleaned.replace(/^\+972[-\s]?/, '0');
  cleaned = cleaned.replace(/\D/g, '');

  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.slice(3);
  }

  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    return cleaned;
  }

  if (cleaned.length === 9 && cleaned.startsWith('5')) {
    return '0' + cleaned;
  }

  if (cleaned.length >= 9) {
    return cleaned;
  }

  return null;
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformRow(row) {
  const fullName = row[0] || '';

  if (!fullName.trim()) {
    return null;
  }

  const { firstName, lastName } = splitName(fullName);
  const email = (row[6] || '').trim().toLowerCase() || null;
  const phone = normalizePhone(row[8] || '');

  let cohortYear = null;
  const yearMatch = (row[15] || '').match(/\d{4}/);
  if (yearMatch) {
    cohortYear = yearMatch[0];
  }

  const tags = ['PIF'];
  if (row[4]) tags.push(row[4]);
  if (row[5]) tags.push(row[5]);
  if (cohortYear) tags.push(`מחזור ${cohortYear}`);

  return {
    firstName,
    lastName,
    email,
    phone,
    cohortYear,
    tags,
    rawName: fullName,
  };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

function removeDuplicates(persons) {
  const seen = new Set();
  const unique = [];
  let duplicateCount = 0;

  for (const person of persons) {
    if (!person.email) {
      unique.push(person);
      continue;
    }

    const key = `${person.firstName} ${person.lastName}|${person.email}`.toLowerCase();

    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }

    seen.add(key);
    unique.push(person);
  }

  return { unique, duplicateCount };
}

// ============================================================================
// MAIN
// ============================================================================

const csvPath = process.argv[2];

if (!csvPath) {
  console.log('Usage: node scripts/import-pif-dryrun.mjs <csv-file-path>');
  process.exit(1);
}

console.log('\n========================================');
console.log('PIF Alumni Import - DRY RUN');
console.log('========================================');
console.log(`CSV File: ${csvPath}`);
console.log('========================================\n');

// Read and parse CSV
console.log('📄 Reading CSV file...');
const content = readFileSync(csvPath, 'utf8');
const rawRows = parseCSV(content);
const dataRows = rawRows.slice(1);  // Skip header
console.log(`   Found ${dataRows.length} rows\n`);

// Transform rows
console.log('🔄 Transforming data...');
const parsedPersons = dataRows.map(transformRow).filter(p => p !== null);
console.log(`   Parsed ${parsedPersons.length} valid persons\n`);

// Remove duplicates
console.log('🔍 Detecting duplicates...');
const { unique, duplicateCount } = removeDuplicates(parsedPersons);
console.log(`   Found ${duplicateCount} duplicates`);
console.log(`   ${unique.length} unique persons to import\n`);

// Get cohort years
const cohortYears = [...new Set(
  unique.map(p => p.cohortYear).filter(y => y !== null)
)].sort();
console.log(`📅 Cohort years: ${cohortYears.join(', ')}\n`);

// Count stats
const withEmail = unique.filter(p => p.email).length;
const withPhone = unique.filter(p => p.phone).length;
const withCohort = unique.filter(p => p.cohortYear).length;

console.log('📊 Data quality:');
console.log(`   With email:    ${withEmail} / ${unique.length} (${Math.round(withEmail/unique.length*100)}%)`);
console.log(`   With phone:    ${withPhone} / ${unique.length} (${Math.round(withPhone/unique.length*100)}%)`);
console.log(`   With cohort:   ${withCohort} / ${unique.length} (${Math.round(withCohort/unique.length*100)}%)`);

// Show sample records
console.log('\n📋 Sample records (first 15):');
console.log('─'.repeat(120));

unique.slice(0, 15).forEach((p, i) => {
  console.log(`${String(i+1).padStart(3)}. ${p.firstName} ${p.lastName}`);
  console.log(`     Email: ${p.email || '(none)'}`);
  console.log(`     Phone: ${p.phone || '(none)'}`);
  console.log(`     Cohort: ${p.cohortYear || '(none)'}`);
  console.log(`     Tags: ${p.tags.join(', ')}`);
  console.log('');
});

// Summary
console.log('========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total CSV rows:        ${dataRows.length}`);
console.log(`Valid persons:         ${parsedPersons.length}`);
console.log(`Duplicates removed:    ${duplicateCount}`);
console.log(`Unique to import:      ${unique.length}`);
console.log(`With email:            ${withEmail}`);
console.log(`Without email:         ${unique.length - withEmail}`);
console.log('========================================\n');

console.log('✅ Dry run complete. Ready for real import.');
