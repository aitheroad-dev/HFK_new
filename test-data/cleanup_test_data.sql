-- ============================================================================
-- HKF CRM Test Data Cleanup Script
-- Created: 2025-12-18
--
-- This script removes all test data created by seed_100_test_people.sql
-- It identifies test data by the 'TEST_DATA' tag in the people.tags array
-- ============================================================================

-- First, delete dependent records (order matters due to foreign keys)

-- Delete payments linked to test people
DELETE FROM payments
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Delete communications linked to test people
DELETE FROM communications
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Delete event registrations linked to test people
DELETE FROM event_registrations
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Delete escalations linked to test people
DELETE FROM escalations
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Delete interviews linked to test people
DELETE FROM interviews
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Delete enrollments linked to test people
DELETE FROM enrollments
WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));

-- Finally, delete the test people themselves
DELETE FROM people WHERE 'TEST_DATA' = ANY(tags);

-- Verify cleanup
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM people WHERE 'TEST_DATA' = ANY(tags);
  IF remaining = 0 THEN
    RAISE NOTICE 'Cleanup complete. All test data has been removed.';
  ELSE
    RAISE WARNING 'Cleanup incomplete. % test people still remain.', remaining;
  END IF;
END $$;
