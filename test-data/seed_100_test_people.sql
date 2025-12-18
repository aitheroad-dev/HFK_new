-- ============================================================================
-- HKF CRM Test Data: 100 People with Varied Enrollment Stages
-- Created: 2025-12-18
--
-- This script creates 100 test people with realistic variety:
-- - 30% complete profiles, 40% partial, 30% minimal
-- - Various enrollment statuses (applied, interviewing, accepted, rejected, enrolled)
-- - Some with interviews (scheduled, completed, no-show)
-- - Some with payments (pending, completed)
--
-- CLEANUP: All test people have 'TEST_DATA' tag and email ending with @testdata.hkf
-- To delete: DELETE FROM people WHERE 'TEST_DATA' = ANY(tags);
-- ============================================================================

-- Configuration
DO $$
DECLARE
  org_id UUID := '2542c6fe-3707-4dd8-abc5-bc70feac7e81';
  program_id UUID := '60c71816-f1fe-4564-8e9b-3197fa50b31d';

  -- Arrays for random data generation
  first_names_m TEXT[] := ARRAY['David', 'Michael', 'Daniel', 'Yosef', 'Moshe', 'Avi', 'Eli', 'Noam', 'Itai', 'Oren', 'Amit', 'Gal', 'Roi', 'Tal', 'Yaron', 'Eyal', 'Nir', 'Omri', 'Lior', 'Alon', 'Ben', 'Tom', 'Adam', 'Yair', 'Shai'];
  first_names_f TEXT[] := ARRAY['Sarah', 'Rachel', 'Miriam', 'Noa', 'Maya', 'Shira', 'Tamar', 'Yael', 'Michal', 'Tali', 'Inbar', 'Mor', 'Roni', 'Hila', 'Efrat', 'Adi', 'Liat', 'Keren', 'Dana', 'Chen', 'Shani', 'Gali', 'Ella', 'Nitzan', 'Einat'];
  last_names TEXT[] := ARRAY['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Avraham', 'Friedman', 'Azulay', 'Malka', 'Amar', 'Gabay', 'Hadad', 'Katz', 'Yosef', 'Ben-David', 'Shapira', 'Goldstein', 'Rosen', 'Klein', 'Schwartz', 'Weiss', 'Fischer', 'Zilberman', 'Tal'];

  -- Person variables
  person_id UUID;
  enrollment_id UUID;
  interview_id UUID;
  first_name TEXT;
  last_name TEXT;
  email TEXT;
  phone TEXT;
  person_status TEXT;
  enrollment_status TEXT;
  metadata JSONB;
  tags TEXT[];
  profile_type INT; -- 1=complete, 2=partial, 3=minimal

  -- Loop counter
  i INT;
  random_val FLOAT;

BEGIN
  -- Loop to create 100 people
  FOR i IN 1..100 LOOP
    -- Generate UUIDs
    person_id := gen_random_uuid();

    -- Decide profile completeness (30% complete, 40% partial, 30% minimal)
    random_val := random();
    IF random_val < 0.30 THEN
      profile_type := 1; -- Complete
    ELSIF random_val < 0.70 THEN
      profile_type := 2; -- Partial
    ELSE
      profile_type := 3; -- Minimal
    END IF;

    -- Generate name (50% male, 50% female)
    IF random() < 0.5 THEN
      first_name := first_names_m[1 + floor(random() * array_length(first_names_m, 1))];
    ELSE
      first_name := first_names_f[1 + floor(random() * array_length(first_names_f, 1))];
    END IF;
    last_name := last_names[1 + floor(random() * array_length(last_names, 1))];

    -- Generate unique email (all have @testdata.hkf suffix for easy identification)
    email := lower(first_name) || '.' || lower(last_name) || '.' || i || '@testdata.hkf';

    -- Generate phone (Israeli format) based on profile type
    IF profile_type <= 2 THEN
      phone := '05' || (2 + floor(random() * 6))::TEXT || '-' ||
               lpad((floor(random() * 10000000))::TEXT, 7, '0');
    ELSE
      phone := NULL;
    END IF;

    -- Tags - all have TEST_DATA, some have additional tags
    tags := ARRAY['TEST_DATA'];
    IF profile_type = 1 THEN
      IF random() < 0.3 THEN tags := array_append(tags, 'priority'); END IF;
      IF random() < 0.2 THEN tags := array_append(tags, 'referral'); END IF;
      IF random() < 0.2 THEN tags := array_append(tags, 'returning'); END IF;
    END IF;

    -- Generate metadata based on profile type
    IF profile_type = 1 THEN
      metadata := jsonb_build_object(
        'source', CASE floor(random() * 4)
          WHEN 0 THEN 'website'
          WHEN 1 THEN 'referral'
          WHEN 2 THEN 'social_media'
          ELSE 'event'
        END,
        'city', CASE floor(random() * 6)
          WHEN 0 THEN 'Tel Aviv'
          WHEN 1 THEN 'Jerusalem'
          WHEN 2 THEN 'Haifa'
          WHEN 3 THEN 'Beer Sheva'
          WHEN 4 THEN 'Netanya'
          ELSE 'Ramat Gan'
        END,
        'occupation', CASE floor(random() * 8)
          WHEN 0 THEN 'Software Engineer'
          WHEN 1 THEN 'Teacher'
          WHEN 2 THEN 'Marketing Manager'
          WHEN 3 THEN 'Consultant'
          WHEN 4 THEN 'Designer'
          WHEN 5 THEN 'Sales Representative'
          WHEN 6 THEN 'Entrepreneur'
          ELSE 'Student'
        END,
        'age', 22 + floor(random() * 40),
        'notes', 'Test data generated for HKF CRM'
      );
    ELSIF profile_type = 2 THEN
      metadata := jsonb_build_object(
        'source', CASE floor(random() * 4)
          WHEN 0 THEN 'website'
          WHEN 1 THEN 'referral'
          WHEN 2 THEN 'social_media'
          ELSE 'event'
        END,
        'notes', 'Test data - partial profile'
      );
    ELSE
      metadata := jsonb_build_object('notes', 'Test data - minimal profile');
    END IF;

    -- Determine enrollment status distribution:
    -- 25% applied, 20% interviewing, 25% accepted, 10% rejected, 15% enrolled, 5% dropped
    random_val := random();
    IF random_val < 0.25 THEN
      enrollment_status := 'applied';
      person_status := 'pending';
    ELSIF random_val < 0.45 THEN
      enrollment_status := 'interviewing';
      person_status := 'pending';
    ELSIF random_val < 0.70 THEN
      enrollment_status := 'accepted';
      person_status := 'active';
    ELSIF random_val < 0.80 THEN
      enrollment_status := 'rejected';
      person_status := 'inactive';
    ELSIF random_val < 0.95 THEN
      enrollment_status := 'enrolled';
      person_status := 'active';
    ELSE
      enrollment_status := 'dropped';
      person_status := 'archived';
    END IF;

    -- Insert person
    INSERT INTO people (id, organization_id, first_name, last_name, email, phone, status, metadata, tags, created_at, updated_at)
    VALUES (
      person_id,
      org_id,
      first_name,
      last_name,
      email,
      phone,
      person_status,
      metadata,
      tags,
      NOW() - (random() * interval '90 days'), -- Created in last 90 days
      NOW() - (random() * interval '30 days')  -- Updated in last 30 days
    );

    -- Create enrollment for most people (90%)
    IF random() < 0.90 THEN
      enrollment_id := gen_random_uuid();

      INSERT INTO enrollments (id, organization_id, person_id, program_id, status, application_data, applied_at, enrolled_at, created_at, updated_at)
      VALUES (
        enrollment_id,
        org_id,
        person_id,
        program_id,
        enrollment_status,
        CASE
          WHEN profile_type = 1 THEN jsonb_build_object(
            'motivation', 'I want to develop my leadership skills and grow professionally.',
            'experience', CASE floor(random() * 3)
              WHEN 0 THEN '2 years in team management'
              WHEN 1 THEN 'No formal leadership experience but eager to learn'
              ELSE '5+ years managing projects'
            END,
            'goals', ARRAY['networking', 'skill development', 'career growth']
          )
          WHEN profile_type = 2 THEN jsonb_build_object(
            'motivation', 'Interested in leadership development.'
          )
          ELSE '{}'::jsonb
        END,
        NOW() - (random() * interval '60 days'),
        CASE WHEN enrollment_status = 'enrolled' THEN NOW() - (random() * interval '14 days') ELSE NULL END,
        NOW() - (random() * interval '60 days'),
        NOW() - (random() * interval '14 days')
      );

      -- Create interviews for people in interviewing, accepted, rejected, or enrolled status (about 60% of enrollments)
      IF enrollment_status IN ('interviewing', 'accepted', 'rejected', 'enrolled') THEN
        interview_id := gen_random_uuid();

        INSERT INTO interviews (id, organization_id, person_id, program_id, enrollment_id, scheduled_at, duration_minutes, location, status, outcome, notes, interviewer_notes, created_at, updated_at)
        VALUES (
          interview_id,
          org_id,
          person_id,
          program_id,
          enrollment_id,
          CASE
            WHEN enrollment_status = 'interviewing' THEN NOW() + (random() * interval '14 days') -- Future interview
            ELSE NOW() - (random() * interval '30 days') -- Past interview
          END,
          CASE floor(random() * 3)
            WHEN 0 THEN '30'
            WHEN 1 THEN '45'
            ELSE '60'
          END,
          CASE floor(random() * 3)
            WHEN 0 THEN 'Zoom'
            WHEN 1 THEN 'Phone'
            ELSE 'In-person at office'
          END,
          CASE
            WHEN enrollment_status = 'interviewing' THEN 'scheduled'
            WHEN random() < 0.1 THEN 'no_show'
            ELSE 'completed'
          END,
          CASE
            WHEN enrollment_status IN ('accepted', 'enrolled') THEN 'passed'
            WHEN enrollment_status = 'rejected' THEN 'failed'
            WHEN enrollment_status = 'interviewing' THEN NULL
            ELSE 'pending_decision'
          END,
          CASE WHEN enrollment_status != 'interviewing' AND profile_type <= 2 THEN
            'Interview conducted. Candidate was ' ||
            CASE floor(random() * 3)
              WHEN 0 THEN 'well-prepared and articulate.'
              WHEN 1 THEN 'enthusiastic but needs more experience.'
              ELSE 'a good fit for the program.'
            END
          ELSE NULL END,
          CASE WHEN enrollment_status != 'interviewing' THEN
            jsonb_build_object(
              'score', 5 + floor(random() * 6), -- Score 5-10
              'strengths', ARRAY['communication', 'motivation', 'potential'],
              'concerns', CASE WHEN random() < 0.3 THEN ARRAY['time commitment'] ELSE ARRAY[]::TEXT[] END,
              'recommendation', CASE
                WHEN enrollment_status IN ('accepted', 'enrolled') THEN 'Accept'
                WHEN enrollment_status = 'rejected' THEN 'Reject'
                ELSE 'Maybe'
              END
            )
          ELSE NULL END,
          NOW() - (random() * interval '45 days'),
          NOW() - (random() * interval '14 days')
        );
      END IF;

      -- Create payments for enrolled people (and some accepted)
      IF enrollment_status = 'enrolled' OR (enrollment_status = 'accepted' AND random() < 0.3) THEN
        INSERT INTO payments (id, organization_id, person_id, program_id, enrollment_id, amount, currency, description, status, provider, payment_method, paid_at, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          org_id,
          person_id,
          program_id,
          enrollment_id,
          50000, -- 500.00 USD in cents
          'USD',
          'Leadership Course 2025 - Program Fee',
          CASE
            WHEN enrollment_status = 'enrolled' THEN 'completed'
            ELSE CASE WHEN random() < 0.5 THEN 'pending' ELSE 'completed' END
          END,
          'meshulam',
          CASE floor(random() * 2)
            WHEN 0 THEN 'credit_card'
            ELSE 'bank_transfer'
          END,
          CASE WHEN enrollment_status = 'enrolled' OR random() < 0.5 THEN NOW() - (random() * interval '14 days') ELSE NULL END,
          NOW() - (random() * interval '30 days'),
          NOW() - (random() * interval '7 days')
        );
      END IF;

    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully created 100 test people with enrollments, interviews, and payments';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run after insert to verify data)
-- ============================================================================

-- Count people by status
-- SELECT status, COUNT(*) FROM people WHERE 'TEST_DATA' = ANY(tags) GROUP BY status;

-- Count enrollments by status
-- SELECT status, COUNT(*) FROM enrollments e
-- JOIN people p ON e.person_id = p.id
-- WHERE 'TEST_DATA' = ANY(p.tags)
-- GROUP BY status;

-- Count interviews by status
-- SELECT status, COUNT(*) FROM interviews i
-- JOIN people p ON i.person_id = p.id
-- WHERE 'TEST_DATA' = ANY(p.tags)
-- GROUP BY status;

-- Count payments by status
-- SELECT status, COUNT(*) FROM payments py
-- JOIN people p ON py.person_id = p.id
-- WHERE 'TEST_DATA' = ANY(p.tags)
-- GROUP BY status;

-- ============================================================================
-- CLEANUP SCRIPT (use this to delete all test data)
-- ============================================================================

-- DELETE FROM payments WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));
-- DELETE FROM interviews WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));
-- DELETE FROM enrollments WHERE person_id IN (SELECT id FROM people WHERE 'TEST_DATA' = ANY(tags));
-- DELETE FROM people WHERE 'TEST_DATA' = ANY(tags);
