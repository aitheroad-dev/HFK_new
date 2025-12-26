/**
 * PIF Alumni Import Script (ESM version with built-in CSV parsing)
 *
 * Imports people from the PIF CSV file into HKF-CRM database.
 *
 * Usage:
 *   node scripts/import-pif-alumni.mjs <csv-file-path> [--dry-run]
 *
 * Options:
 *   --dry-run    Parse and validate without inserting into database
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const HKF_ORG_ID = '2542c6fe-3707-4dd8-abc5-bc70feac7e81';
const PROGRAM_NAME = 'PIF';
const PROGRAM_DESCRIPTION = 'בוגרי קהילת PIF - תכנית מנהיגות';

// ============================================================================
// SCHEMA DEFINITIONS (inline to avoid import issues)
// ============================================================================

const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
});

const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  status: text('status').default('pending'),
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type'),
  config: jsonb('config').default({}),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const cohorts = pgTable('cohorts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  programId: uuid('program_id').notNull(),
  name: text('name').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  maxParticipants: integer('max_participants'),
  status: text('status').default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  personId: uuid('person_id').notNull(),
  programId: uuid('program_id').notNull(),
  cohortId: uuid('cohort_id'),
  status: text('status').default('applied'),
  applicationData: jsonb('application_data').default({}),
  appliedAt: timestamp('applied_at').defaultNow(),
  enrolledAt: timestamp('enrolled_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CSV PARSING (built-in, no external dependency)
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
        // Escaped quote
        currentField += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        insideQuotes = true;
      } else if (char === ',') {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // End of row
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

  // Handle last field/row
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

  // Check if it's an international number (non-Israeli)
  if (cleaned.startsWith('+') && !cleaned.startsWith('+972')) {
    return cleaned;
  }

  // Israeli number - normalize to 05XXXXXXXX
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

  const metadata = {};
  if (row[1]) metadata.age = parseInt(row[1]) || row[1];
  if (row[2]) metadata.gender = row[2];
  if (row[3]) metadata.religiousAffiliation = row[3];
  if (row[9]) metadata.livingArea = row[9];
  if (row[10]) metadata.careerStage = row[10];
  if (row[11]) metadata.employmentType = row[11];
  if (row[12]) metadata.workplace = row[12];
  if (row[13]) metadata.workType = row[13];
  if (row[14]) metadata.role = row[14];
  if (row[16]) metadata.mentors = row[16];
  if (row[17]) metadata.globalOrIsrael = row[17];
  if (row[18]) metadata.degree = row[18];

  const birthYear = row[27] || row[26];
  if (birthYear) metadata.birthYear = parseInt(birthYear) || birthYear;

  const tags = ['PIF'];
  if (row[4]) tags.push(row[4]);  // pifConnection
  if (row[5]) tags.push(row[5]);  // connectionDetails
  if (cohortYear) tags.push(`מחזור ${cohortYear}`);

  return {
    firstName,
    lastName,
    email,
    phone,
    cohortYear,
    metadata,
    tags,
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
// DATABASE OPERATIONS
// ============================================================================

async function ensureProgram(db) {
  const existing = await db
    .select()
    .from(programs)
    .where(and(eq(programs.organizationId, HKF_ORG_ID), eq(programs.name, PROGRAM_NAME)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`✓ Found existing program: ${PROGRAM_NAME} (${existing[0].id})`);
    return existing[0].id;
  }

  const [program] = await db
    .insert(programs)
    .values({
      organizationId: HKF_ORG_ID,
      name: PROGRAM_NAME,
      description: PROGRAM_DESCRIPTION,
      type: 'leadership',
      config: { requiresInterview: false, requiresPayment: false },
      isActive: true,
    })
    .returning();

  console.log(`✓ Created program: ${PROGRAM_NAME} (${program.id})`);
  return program.id;
}

async function ensureCohorts(db, programId, years) {
  const cohortMap = new Map();

  for (const year of years) {
    const existing = await db
      .select()
      .from(cohorts)
      .where(
        and(
          eq(cohorts.organizationId, HKF_ORG_ID),
          eq(cohorts.programId, programId),
          eq(cohorts.name, `מחזור ${year}`)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      cohortMap.set(year, existing[0].id);
      console.log(`✓ Found existing cohort: מחזור ${year} (${existing[0].id})`);
    } else {
      const [cohort] = await db
        .insert(cohorts)
        .values({
          organizationId: HKF_ORG_ID,
          programId,
          name: `מחזור ${year}`,
          status: 'completed',
          startDate: new Date(`${year}-01-01`),
          endDate: new Date(`${year}-12-31`),
        })
        .returning();

      cohortMap.set(year, cohort.id);
      console.log(`✓ Created cohort: מחזור ${year} (${cohort.id})`);
    }
  }

  return cohortMap;
}

async function importPeople(db, persons, programId, cohortMap, dryRun) {
  const stats = {
    totalRows: persons.length,
    validRows: 0,
    skippedNoEmail: 0,
    inserted: 0,
    enrollmentsCreated: 0,
    errors: [],
  };

  for (const person of persons) {
    try {
      if (!person.email) {
        stats.skippedNoEmail++;
        continue;
      }

      stats.validRows++;

      if (dryRun) {
        console.log(`[DRY-RUN] Would insert: ${person.firstName} ${person.lastName} <${person.email}> | Phone: ${person.phone || 'N/A'} | Cohort: ${person.cohortYear || 'N/A'}`);
        stats.inserted++;
        if (person.cohortYear && cohortMap.has(person.cohortYear)) {
          stats.enrollmentsCreated++;
        }
        continue;
      }

      // Check if person exists
      const existingPerson = await db
        .select()
        .from(people)
        .where(and(eq(people.organizationId, HKF_ORG_ID), eq(people.email, person.email)))
        .limit(1);

      let personId;

      if (existingPerson.length > 0) {
        personId = existingPerson[0].id;
        console.log(`⊘ Person exists: ${person.firstName} ${person.lastName} (${personId})`);
      } else {
        const [inserted] = await db
          .insert(people)
          .values({
            organizationId: HKF_ORG_ID,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            status: 'active',
            metadata: person.metadata,
            tags: person.tags,
          })
          .returning();

        personId = inserted.id;
        stats.inserted++;
        console.log(`✓ Inserted: ${person.firstName} ${person.lastName} (${personId})`);
      }

      // Create enrollment
      if (person.cohortYear && cohortMap.has(person.cohortYear)) {
        const cohortId = cohortMap.get(person.cohortYear);

        const existingEnrollment = await db
          .select()
          .from(enrollments)
          .where(
            and(
              eq(enrollments.organizationId, HKF_ORG_ID),
              eq(enrollments.personId, personId),
              eq(enrollments.programId, programId)
            )
          )
          .limit(1);

        if (existingEnrollment.length === 0) {
          await db
            .insert(enrollments)
            .values({
              organizationId: HKF_ORG_ID,
              personId,
              programId,
              cohortId,
              status: 'completed',
              enrolledAt: new Date(`${person.cohortYear}-01-01`),
              completedAt: new Date(`${person.cohortYear}-12-31`),
            });

          stats.enrollmentsCreated++;
        }
      }
    } catch (error) {
      const errorMsg = `Error importing ${person.firstName} ${person.lastName}: ${error}`;
      stats.errors.push(errorMsg);
      console.error(`✗ ${errorMsg}`);
    }
  }

  return stats;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
PIF Alumni Import Script

Usage:
  node scripts/import-pif-alumni.mjs <csv-file-path> [--dry-run]

Options:
  --dry-run    Parse and validate without inserting into database
  --help       Show this help message
`);
    process.exit(0);
  }

  const csvPath = args.find(arg => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  console.log('\n========================================');
  console.log('PIF Alumni Import Script');
  console.log('========================================');
  console.log(`CSV File: ${csvPath}`);
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('========================================\n');

  // Read and parse CSV
  console.log('📄 Reading CSV file...');
  const content = readFileSync(csvPath, 'utf8');
  const rawRows = parseCSV(content);

  // Skip header row
  const dataRows = rawRows.slice(1);
  console.log(`   Found ${dataRows.length} rows\n`);

  // Transform rows
  console.log('🔄 Transforming data...');
  const parsedPersons = dataRows
    .map(transformRow)
    .filter(p => p !== null);
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

  // Connect to database
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const client = postgres(dbUrl);
  const db = drizzle(client);
  console.log('   Connected!\n');

  try {
    // Setup program and cohorts
    console.log('📚 Setting up program...');
    const programId = await ensureProgram(db);

    console.log('\n📅 Setting up cohorts...');
    const cohortMap = await ensureCohorts(db, programId, cohortYears);

    // Import people
    console.log('\n👥 Importing people...');
    const stats = await importPeople(db, unique, programId, cohortMap, dryRun);

    // Summary
    console.log('\n========================================');
    console.log('IMPORT SUMMARY');
    console.log('========================================');
    console.log(`Total CSV rows:        ${stats.totalRows}`);
    console.log(`Valid rows:            ${stats.validRows}`);
    console.log(`Skipped (no email):    ${stats.skippedNoEmail}`);
    console.log(`Skipped (duplicates):  ${duplicateCount}`);
    console.log(`People inserted:       ${stats.inserted}`);
    console.log(`Enrollments created:   ${stats.enrollmentsCreated}`);
    console.log(`Errors:                ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No data was inserted');
    } else {
      console.log('\n✅ Import completed successfully!');
    }

  } finally {
    await client.end();
  }
}

main().catch(console.error);
