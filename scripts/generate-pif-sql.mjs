/**
 * PIF Alumni - Generate SQL Import Script
 *
 * Parses the CSV and generates SQL INSERT statements.
 *
 * Usage:
 *   node scripts/generate-pif-sql.mjs <csv-file-path> > scripts/import-pif-data.sql
 */

import { readFileSync, writeFileSync } from 'fs';

const HKF_ORG_ID = '2542c6fe-3707-4dd8-abc5-bc70feac7e81';

// ============================================================================
// CSV PARSING
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
// NAME SPLITTING
// ============================================================================

function splitName(fullName) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

// ============================================================================
// PHONE NORMALIZATION
// ============================================================================

function normalizePhone(phone) {
  if (!phone || !phone.trim()) return null;

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
// SQL ESCAPING
// ============================================================================

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  // Escape single quotes by doubling them
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJSONB(obj) {
  if (!obj || Object.keys(obj).length === 0) return "'{}'::jsonb";
  const json = JSON.stringify(obj).replace(/'/g, "''");
  return "'" + json + "'::jsonb";
}

function escapeArray(arr) {
  if (!arr || arr.length === 0) return "ARRAY[]::text[]";
  const escaped = arr.map(s => s.replace(/'/g, "''").replace(/"/g, '\\"'));
  return "ARRAY[" + escaped.map(s => "'" + s + "'").join(", ") + "]::text[]";
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformRow(row) {
  const fullName = row[0] || '';
  if (!fullName.trim()) return null;

  const { firstName, lastName } = splitName(fullName);
  const email = (row[6] || '').trim().toLowerCase() || null;
  const phone = normalizePhone(row[8] || '');

  let cohortYear = null;
  const yearMatch = (row[15] || '').match(/\d{4}/);
  if (yearMatch) cohortYear = yearMatch[0];

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
  if (row[4]) tags.push(row[4]);
  if (row[5]) tags.push(row[5]);
  if (cohortYear) tags.push(`מחזור ${cohortYear}`);

  return { firstName, lastName, email, phone, cohortYear, metadata, tags };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

function removeDuplicates(persons) {
  const seen = new Set();
  const unique = [];

  for (const person of persons) {
    if (!person.email) {
      unique.push(person);
      continue;
    }

    const key = `${person.firstName} ${person.lastName}|${person.email}`.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(person);
  }

  return unique;
}

// ============================================================================
// MAIN
// ============================================================================

const csvPath = process.argv[2];
const outputPath = process.argv[3] || '/Users/yaronkra/Projects/aitheroad/hkf-crm/scripts/import-pif-data.sql';

if (!csvPath) {
  console.error('Usage: node scripts/generate-pif-sql.mjs <csv-file-path> [output-sql-path]');
  process.exit(1);
}

// Parse CSV
const content = readFileSync(csvPath, 'utf8');
const rawRows = parseCSV(content);
const dataRows = rawRows.slice(1);

// Transform and dedupe
const parsedPersons = dataRows.map(transformRow).filter(p => p !== null);
const unique = removeDuplicates(parsedPersons);

// Get cohort years
const cohortYears = [...new Set(
  unique.map(p => p.cohortYear).filter(y => y !== null)
)].sort();

// Generate SQL
let sql = `-- =============================================================================
-- PIF Alumni Import Script
-- Generated: ${new Date().toISOString()}
-- Total records: ${unique.length}
-- Cohorts: ${cohortYears.join(', ')}
-- =============================================================================

-- Start transaction
BEGIN;

-- =============================================================================
-- STEP 1: Create PIF Program (if not exists)
-- =============================================================================

INSERT INTO programs (id, organization_id, name, description, type, config, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '${HKF_ORG_ID}',
  'PIF',
  'בוגרי קהילת PIF - תכנית מנהיגות',
  'leadership',
  '{"requiresInterview": false, "requiresPayment": false}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM programs
  WHERE organization_id = '${HKF_ORG_ID}' AND name = 'PIF'
);

-- Get the program ID for later use
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  SELECT id INTO v_program_id FROM programs
  WHERE organization_id = '${HKF_ORG_ID}' AND name = 'PIF';

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'PIF program not found';
  END IF;

  RAISE NOTICE 'PIF Program ID: %', v_program_id;
END $$;

-- =============================================================================
-- STEP 2: Create Cohorts (if not exist)
-- =============================================================================

`;

for (const year of cohortYears) {
  sql += `
-- Cohort ${year}
INSERT INTO cohorts (id, organization_id, program_id, name, status, start_date, end_date, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '${HKF_ORG_ID}',
  (SELECT id FROM programs WHERE organization_id = '${HKF_ORG_ID}' AND name = 'PIF'),
  'מחזור ${year}',
  'completed',
  '${year}-01-01'::timestamp,
  '${year}-12-31'::timestamp,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM cohorts
  WHERE organization_id = '${HKF_ORG_ID}'
    AND program_id = (SELECT id FROM programs WHERE organization_id = '${HKF_ORG_ID}' AND name = 'PIF')
    AND name = 'מחזור ${year}'
);
`;
}

sql += `
-- =============================================================================
-- STEP 3: Create temporary table for import
-- =============================================================================

CREATE TEMP TABLE pif_import (
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cohort_year TEXT,
  metadata JSONB,
  tags TEXT[]
);

-- =============================================================================
-- STEP 4: Insert data into temp table
-- =============================================================================

INSERT INTO pif_import (first_name, last_name, email, phone, cohort_year, metadata, tags) VALUES
`;

// Generate INSERT values
const values = unique.map((p, i) => {
  const firstName = escapeSQL(p.firstName);
  const lastName = escapeSQL(p.lastName);
  const email = p.email ? escapeSQL(p.email) : 'NULL';
  const phone = p.phone ? escapeSQL(p.phone) : 'NULL';
  const cohortYear = p.cohortYear ? escapeSQL(p.cohortYear) : 'NULL';
  const metadata = escapeJSONB(p.metadata);
  const tags = escapeArray(p.tags);

  return `(${firstName}, ${lastName}, ${email}, ${phone}, ${cohortYear}, ${metadata}, ${tags})`;
});

sql += values.join(',\n') + ';\n';

sql += `
-- =============================================================================
-- STEP 5: Insert people (skip if email already exists)
-- =============================================================================

INSERT INTO people (id, organization_id, first_name, last_name, email, phone, status, metadata, tags, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '${HKF_ORG_ID}',
  i.first_name,
  i.last_name,
  i.email,
  i.phone,
  'active',
  i.metadata,
  i.tags,
  NOW(),
  NOW()
FROM pif_import i
WHERE i.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM people p
    WHERE p.organization_id = '${HKF_ORG_ID}'
      AND p.email = i.email
  );

-- Also insert people without email (using name to check duplicates)
INSERT INTO people (id, organization_id, first_name, last_name, email, phone, status, metadata, tags, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '${HKF_ORG_ID}',
  i.first_name,
  i.last_name,
  NULL,
  i.phone,
  'active',
  i.metadata,
  i.tags,
  NOW(),
  NOW()
FROM pif_import i
WHERE i.email IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM people p
    WHERE p.organization_id = '${HKF_ORG_ID}'
      AND p.first_name = i.first_name
      AND p.last_name = i.last_name
      AND p.email IS NULL
  );

-- =============================================================================
-- STEP 6: Create enrollments
-- =============================================================================

INSERT INTO enrollments (id, organization_id, person_id, program_id, cohort_id, status, enrolled_at, completed_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '${HKF_ORG_ID}',
  p.id,
  prog.id,
  c.id,
  'completed',
  (i.cohort_year || '-01-01')::timestamp,
  (i.cohort_year || '-12-31')::timestamp,
  NOW(),
  NOW()
FROM pif_import i
JOIN people p ON (
  p.organization_id = '${HKF_ORG_ID}'
  AND (
    (i.email IS NOT NULL AND p.email = i.email)
    OR (i.email IS NULL AND p.first_name = i.first_name AND p.last_name = i.last_name AND p.email IS NULL)
  )
)
JOIN programs prog ON (prog.organization_id = '${HKF_ORG_ID}' AND prog.name = 'PIF')
JOIN cohorts c ON (
  c.organization_id = '${HKF_ORG_ID}'
  AND c.program_id = prog.id
  AND c.name = 'מחזור ' || i.cohort_year
)
WHERE i.cohort_year IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.organization_id = '${HKF_ORG_ID}'
      AND e.person_id = p.id
      AND e.program_id = prog.id
  );

-- =============================================================================
-- STEP 7: Cleanup and report
-- =============================================================================

-- Count results
DO $$
DECLARE
  v_people_count INT;
  v_enrollment_count INT;
BEGIN
  SELECT COUNT(*) INTO v_people_count
  FROM people WHERE organization_id = '${HKF_ORG_ID}' AND 'PIF' = ANY(tags);

  SELECT COUNT(*) INTO v_enrollment_count
  FROM enrollments e
  JOIN programs p ON e.program_id = p.id
  WHERE e.organization_id = '${HKF_ORG_ID}' AND p.name = 'PIF';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'IMPORT COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PIF People in database: %', v_people_count;
  RAISE NOTICE 'PIF Enrollments in database: %', v_enrollment_count;
  RAISE NOTICE '========================================';
END $$;

-- Drop temp table
DROP TABLE pif_import;

-- Commit transaction
COMMIT;

-- =============================================================================
-- END OF IMPORT SCRIPT
-- =============================================================================
`;

// Write to file
writeFileSync(outputPath, sql, 'utf8');
console.error(`✅ SQL script generated: ${outputPath}`);
console.error(`   Total records: ${unique.length}`);
console.error(`   Cohorts: ${cohortYears.join(', ')}`);
