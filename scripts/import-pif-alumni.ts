/**
 * PIF Alumni Import Script
 *
 * Imports people from the PIF CSV file into HKF-CRM database.
 *
 * Usage:
 *   npx tsx scripts/import-pif-alumni.ts <csv-file-path> [--dry-run]
 *
 * Options:
 *   --dry-run    Parse and validate without inserting into database
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../packages/db/src/schema/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const HKF_ORG_ID = '2542c6fe-3707-4dd8-abc5-bc70feac7e81';
const PROGRAM_NAME = 'PIF';
const PROGRAM_DESCRIPTION = 'בוגרי קהילת PIF - תכנית מנהיגות';

// ============================================================================
// TYPES
// ============================================================================

interface CsvRow {
  fullName: string;
  age: string;
  gender: string;
  religiousAffiliation: string;
  pifConnection: string;
  connectionDetails: string;
  email: string;
  removeFromMailingList: string;
  phone: string;
  livingArea: string;
  careerStage: string;
  employmentType: string;
  workplace: string;
  workType: string;
  role: string;
  cohortYear: string;
  mentors: string;
  globalOrIsrael: string;
  degree: string;
  birthYear: string;
}

interface ParsedPerson {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  cohortYear: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  rawRow: CsvRow;
}

interface ImportStats {
  totalRows: number;
  validRows: number;
  skippedNoEmail: number;
  skippedDuplicates: number;
  inserted: number;
  enrollmentsCreated: number;
  errors: string[];
}

// ============================================================================
// NAME SPLITTING (Hebrew)
// ============================================================================

/**
 * Splits a Hebrew full name into first and last name.
 * Hebrew names: last word = last name, rest = first name
 *
 * Examples:
 *   "מאיר חזן" → { firstName: "מאיר", lastName: "חזן" }
 *   "מיכל לוי שפינט" → { firstName: "מיכל לוי", lastName: "שפינט" }
 *   "Assaf Landschaft" → { firstName: "Assaf", lastName: "Landschaft" }
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();

  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    // Single name - use as first name
    return { firstName: parts[0], lastName: '' };
  }

  // Last word is last name, rest is first name
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');

  return { firstName, lastName };
}

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

/**
 * Normalizes phone numbers:
 * - Israeli phones: Convert to 05XXXXXXXX format (10 digits, no dashes, no +972)
 * - International phones: Leave as-is if starts with + and non-972 country code
 *
 * Examples:
 *   "+972-52-123-4567" → "0521234567"
 *   "052-123-4567" → "0521234567"
 *   "0521234567" → "0521234567"
 *   "+31613169552" → "+31613169552" (Netherlands - unchanged)
 *   "+1 (949) 403-0537" → "+1 (949) 403-0537" (USA - unchanged)
 */
function normalizePhone(phone: string): string | null {
  if (!phone || !phone.trim()) {
    return null;
  }

  let cleaned = phone.trim();

  // Check if it's an international number (non-Israeli)
  if (cleaned.startsWith('+') && !cleaned.startsWith('+972')) {
    // International number - return as-is (just trim whitespace)
    return cleaned;
  }

  // Israeli number - normalize to 05XXXXXXXX

  // Remove +972 prefix
  cleaned = cleaned.replace(/^\+972[-\s]?/, '0');

  // Remove all non-digit characters
  cleaned = cleaned.replace(/\D/g, '');

  // Handle cases where number starts with 972 (without +)
  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.slice(3);
  }

  // Validate Israeli mobile format (10 digits starting with 05)
  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    return cleaned;
  }

  // Try to fix 9-digit numbers (missing leading 0)
  if (cleaned.length === 9 && cleaned.startsWith('5')) {
    return '0' + cleaned;
  }

  // Return cleaned version even if not perfect format
  // (better than losing the data)
  if (cleaned.length >= 9) {
    return cleaned;
  }

  return null;
}

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parses the CSV file and returns structured data
 */
async function parseCsvFile(filePath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];

    const parser = parse({
      columns: false,  // We'll handle column mapping manually
      skip_empty_lines: true,
      relaxColumnCount: true,  // Handle rows with varying column counts
      encoding: 'utf8',
    });

    parser.on('data', (row: string[]) => {
      // Skip header row
      if (row[0] === 'שם מלא') {
        return;
      }

      // Map columns to structured object
      const csvRow: CsvRow = {
        fullName: row[0] || '',
        age: row[1] || '',
        gender: row[2] || '',
        religiousAffiliation: row[3] || '',
        pifConnection: row[4] || '',
        connectionDetails: row[5] || '',
        email: row[6] || '',
        removeFromMailingList: row[7] || '',
        phone: row[8] || '',
        livingArea: row[9] || '',
        careerStage: row[10] || '',
        employmentType: row[11] || '',
        workplace: row[12] || '',
        workType: row[13] || '',
        role: row[14] || '',
        cohortYear: row[15] || '',
        mentors: row[16] || '',
        globalOrIsrael: row[17] || '',
        degree: row[18] || '',
        birthYear: row[27] || row[26] || '',  // Column 27 or 26 depending on row
      };

      rows.push(csvRow);
    });

    parser.on('error', reject);
    parser.on('end', () => resolve(rows));

    createReadStream(filePath, { encoding: 'utf8' }).pipe(parser);
  });
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transforms a CSV row into a ParsedPerson
 */
function transformRow(row: CsvRow): ParsedPerson | null {
  // Skip empty rows
  if (!row.fullName || !row.fullName.trim()) {
    return null;
  }

  const { firstName, lastName } = splitName(row.fullName);
  const email = row.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(row.phone);

  // Parse cohort year
  let cohortYear: string | null = null;
  const yearMatch = row.cohortYear?.match(/\d{4}/);
  if (yearMatch) {
    cohortYear = yearMatch[0];
  }

  // Build metadata object
  const metadata: Record<string, unknown> = {};

  if (row.age) metadata.age = parseInt(row.age) || row.age;
  if (row.gender) metadata.gender = row.gender;
  if (row.religiousAffiliation) metadata.religiousAffiliation = row.religiousAffiliation;
  if (row.livingArea) metadata.livingArea = row.livingArea;
  if (row.careerStage) metadata.careerStage = row.careerStage;
  if (row.employmentType) metadata.employmentType = row.employmentType;
  if (row.workplace) metadata.workplace = row.workplace;
  if (row.workType) metadata.workType = row.workType;
  if (row.role) metadata.role = row.role;
  if (row.mentors) metadata.mentors = row.mentors;
  if (row.globalOrIsrael) metadata.globalOrIsrael = row.globalOrIsrael;
  if (row.degree) metadata.degree = row.degree;
  if (row.birthYear) metadata.birthYear = parseInt(row.birthYear) || row.birthYear;

  // Build tags
  const tags: string[] = ['PIF'];
  if (row.pifConnection) tags.push(row.pifConnection);
  if (row.connectionDetails) tags.push(row.connectionDetails);
  if (cohortYear) tags.push(`מחזור ${cohortYear}`);

  return {
    firstName,
    lastName,
    email,
    phone,
    cohortYear,
    metadata,
    tags,
    rawRow: row,
  };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Creates a unique key for duplicate detection
 */
function createDuplicateKey(person: ParsedPerson): string {
  const normalizedName = `${person.firstName} ${person.lastName}`.toLowerCase().trim();
  const normalizedEmail = person.email?.toLowerCase().trim() || '';
  return `${normalizedName}|${normalizedEmail}`;
}

/**
 * Filters out duplicates from the list
 */
function removeDuplicates(persons: ParsedPerson[]): { unique: ParsedPerson[]; duplicateCount: number } {
  const seen = new Set<string>();
  const unique: ParsedPerson[] = [];
  let duplicateCount = 0;

  for (const person of persons) {
    if (!person.email) {
      // Can't detect duplicates without email - skip duplicate check
      unique.push(person);
      continue;
    }

    const key = createDuplicateKey(person);

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

/**
 * Ensures the PIF program exists and returns its ID
 */
async function ensureProgram(db: ReturnType<typeof drizzle>): Promise<string> {
  // Check if program exists
  const existing = await db
    .select()
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.organizationId, HKF_ORG_ID),
        eq(schema.programs.name, PROGRAM_NAME)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(`✓ Found existing program: ${PROGRAM_NAME} (${existing[0].id})`);
    return existing[0].id;
  }

  // Create program
  const [program] = await db
    .insert(schema.programs)
    .values({
      organizationId: HKF_ORG_ID,
      name: PROGRAM_NAME,
      description: PROGRAM_DESCRIPTION,
      type: 'leadership',
      config: {
        requiresInterview: false,
        requiresPayment: false,
      },
      isActive: true,
    })
    .returning();

  console.log(`✓ Created program: ${PROGRAM_NAME} (${program.id})`);
  return program.id;
}

/**
 * Ensures cohorts exist for the given years and returns a map of year -> cohortId
 */
async function ensureCohorts(
  db: ReturnType<typeof drizzle>,
  programId: string,
  years: string[]
): Promise<Map<string, string>> {
  const cohortMap = new Map<string, string>();

  for (const year of years) {
    // Check if cohort exists
    const existing = await db
      .select()
      .from(schema.cohorts)
      .where(
        and(
          eq(schema.cohorts.organizationId, HKF_ORG_ID),
          eq(schema.cohorts.programId, programId),
          eq(schema.cohorts.name, `מחזור ${year}`)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      cohortMap.set(year, existing[0].id);
      console.log(`✓ Found existing cohort: מחזור ${year} (${existing[0].id})`);
    } else {
      // Create cohort
      const [cohort] = await db
        .insert(schema.cohorts)
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

/**
 * Imports people into the database
 */
async function importPeople(
  db: ReturnType<typeof drizzle>,
  persons: ParsedPerson[],
  programId: string,
  cohortMap: Map<string, string>,
  dryRun: boolean
): Promise<ImportStats> {
  const stats: ImportStats = {
    totalRows: persons.length,
    validRows: 0,
    skippedNoEmail: 0,
    skippedDuplicates: 0,
    inserted: 0,
    enrollmentsCreated: 0,
    errors: [],
  };

  for (const person of persons) {
    try {
      // Skip if no email (can't properly dedupe or contact)
      if (!person.email) {
        stats.skippedNoEmail++;
        continue;
      }

      stats.validRows++;

      if (dryRun) {
        console.log(`[DRY-RUN] Would insert: ${person.firstName} ${person.lastName} <${person.email}>`);
        stats.inserted++;
        if (person.cohortYear && cohortMap.has(person.cohortYear)) {
          stats.enrollmentsCreated++;
        }
        continue;
      }

      // Check if person already exists in database
      const existingPerson = await db
        .select()
        .from(schema.people)
        .where(
          and(
            eq(schema.people.organizationId, HKF_ORG_ID),
            eq(schema.people.email, person.email)
          )
        )
        .limit(1);

      let personId: string;

      if (existingPerson.length > 0) {
        personId = existingPerson[0].id;
        console.log(`⊘ Person exists: ${person.firstName} ${person.lastName} (${personId})`);
      } else {
        // Insert person
        const [inserted] = await db
          .insert(schema.people)
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

      // Create enrollment if cohort exists
      if (person.cohortYear && cohortMap.has(person.cohortYear)) {
        const cohortId = cohortMap.get(person.cohortYear)!;

        // Check if enrollment exists
        const existingEnrollment = await db
          .select()
          .from(schema.enrollments)
          .where(
            and(
              eq(schema.enrollments.organizationId, HKF_ORG_ID),
              eq(schema.enrollments.personId, personId),
              eq(schema.enrollments.programId, programId)
            )
          )
          .limit(1);

        if (existingEnrollment.length === 0) {
          await db
            .insert(schema.enrollments)
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
  npx tsx scripts/import-pif-alumni.ts <csv-file-path> [--dry-run]

Options:
  --dry-run    Parse and validate without inserting into database
  --help       Show this help message

Example:
  npx tsx scripts/import-pif-alumni.ts "/Users/yaronkra/Downloads/בוגרי קהילת PIF.csv"
  npx tsx scripts/import-pif-alumni.ts "/Users/yaronkra/Downloads/בוגרי קהילת PIF.csv" --dry-run
`);
    process.exit(0);
  }

  const csvPath = args.find(arg => !arg.startsWith('--'))!;
  const dryRun = args.includes('--dry-run');

  console.log('\n========================================');
  console.log('PIF Alumni Import Script');
  console.log('========================================');
  console.log(`CSV File: ${csvPath}`);
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('========================================\n');

  // Parse CSV
  console.log('📄 Parsing CSV file...');
  const rawRows = await parseCsvFile(csvPath);
  console.log(`   Found ${rawRows.length} rows\n`);

  // Transform rows
  console.log('🔄 Transforming data...');
  const parsedPersons = rawRows
    .map(transformRow)
    .filter((p): p is ParsedPerson => p !== null);
  console.log(`   Parsed ${parsedPersons.length} valid persons\n`);

  // Remove duplicates
  console.log('🔍 Detecting duplicates...');
  const { unique, duplicateCount } = removeDuplicates(parsedPersons);
  console.log(`   Found ${duplicateCount} duplicates`);
  console.log(`   ${unique.length} unique persons to import\n`);

  // Get unique cohort years
  const cohortYears = [...new Set(
    unique
      .map(p => p.cohortYear)
      .filter((y): y is string => y !== null)
  )].sort();
  console.log(`📅 Cohort years: ${cohortYears.join(', ')}\n`);

  // Connect to database
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client, { schema });
  console.log('   Connected!\n');

  try {
    // Ensure program exists
    console.log('📚 Setting up program...');
    const programId = await ensureProgram(db);

    // Ensure cohorts exist
    console.log('\n📅 Setting up cohorts...');
    const cohortMap = await ensureCohorts(db, programId, cohortYears);

    // Import people
    console.log('\n👥 Importing people...');
    const stats = await importPeople(db, unique, programId, cohortMap, dryRun);

    // Print summary
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
