-- ============================================================================
-- HKF CRM Test Data: 100 People with Hebrew Data
-- Created: 2025-12-18
--
-- This script creates 100 test people with realistic Hebrew data:
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

  -- Arrays for random data generation - Hebrew names
  first_names_m TEXT[] := ARRAY['דוד', 'מיכאל', 'דניאל', 'יוסף', 'משה', 'אבי', 'אלי', 'נועם', 'איתי', 'אורן', 'עמית', 'גל', 'רועי', 'טל', 'ירון', 'אייל', 'ניר', 'עומרי', 'ליאור', 'אלון', 'בן', 'תום', 'אדם', 'יאיר', 'שי'];
  first_names_f TEXT[] := ARRAY['שרה', 'רחל', 'מרים', 'נעה', 'מאיה', 'שירה', 'תמר', 'יעל', 'מיכל', 'טלי', 'ענבר', 'מור', 'רוני', 'הילה', 'אפרת', 'עדי', 'ליאת', 'קרן', 'דנה', 'חן', 'שני', 'גלי', 'אלה', 'ניצן', 'עינת'];
  last_names TEXT[] := ARRAY['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'אזולאי', 'מלכה', 'עמר', 'גבאי', 'חדד', 'כץ', 'יוסף', 'בן-דוד', 'שפירא', 'גולדשטיין', 'רוזן', 'קליין', 'שוורץ', 'וייס', 'פישר', 'זילברמן', 'טל'];

  -- Hebrew cities
  cities TEXT[] := ARRAY['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'נתניה', 'רמת גן', 'פתח תקווה', 'ראשון לציון', 'אשדוד', 'הרצליה'];

  -- Hebrew occupations
  occupations TEXT[] := ARRAY['מהנדס תוכנה', 'מורה', 'מנהל שיווק', 'יועץ עסקי', 'מעצב גרפי', 'נציג מכירות', 'יזם', 'סטודנט', 'רואה חשבון', 'עורך דין', 'רופא', 'אחות', 'מנהל פרויקטים', 'מפתח אתרים'];

  -- Hebrew sources
  sources TEXT[] := ARRAY['אתר אינטרנט', 'המלצה', 'רשתות חברתיות', 'אירוע', 'פייסבוק', 'לינקדאין'];

  -- Hebrew motivations
  motivations TEXT[] := ARRAY[
    'אני רוצה לפתח את יכולות המנהיגות שלי ולצמוח מקצועית.',
    'מחפש/ת להרחיב את הידע והכישורים שלי בתחום.',
    'רוצה ליצור קשרים עסקיים ולהתפתח בקריירה.',
    'מעוניין/ת ללמוד מאנשי מקצוע מנוסים בתחום.',
    'שואף/ת להוביל שינוי ולהשפיע בסביבה שלי.',
    'רוצה לרכוש כלים מעשיים לניהול והובלת צוותים.'
  ];

  -- Hebrew experience levels
  experiences TEXT[] := ARRAY[
    'שנתיים ניסיון בניהול צוות',
    'ללא ניסיון ניהולי רשמי אבל נלהב/ת ללמוד',
    'מעל 5 שנות ניסיון בניהול פרויקטים',
    'ניסיון בהובלת פרויקטים קטנים',
    'עבדתי כראש צוות במשך 3 שנים',
    'התנסות בניהול התנדבותי בעמותה'
  ];

  -- Hebrew interview notes
  interview_notes_arr TEXT[] := ARRAY[
    'הראיון התנהל היטב. המועמד/ת הציג/ה מוטיבציה גבוהה.',
    'המועמד/ת היה/תה מוכן/ה ומבין/ה את מטרות התוכנית.',
    'התרשמות חיובית. יש פוטנציאל גבוה להצלחה בתוכנית.',
    'מועמד/ת נלהב/ת עם רקע מתאים לתוכנית.',
    'ראיון טוב. המועמד/ת הפגין/ה יכולות תקשורת מצוינות.',
    'יש צורך בליווי נוסף אבל הפוטנציאל קיים.'
  ];

  -- Hebrew strengths
  strengths_arr TEXT[] := ARRAY['תקשורת', 'מוטיבציה', 'פוטנציאל', 'יצירתיות', 'עבודת צוות', 'מנהיגות', 'למידה מהירה', 'יוזמה'];

  -- Hebrew concerns
  concerns_arr TEXT[] := ARRAY['מחויבות זמן', 'ניסיון מוגבל', 'מרחק גיאוגרפי', 'עומס עבודה'];

  -- Person variables
  person_id UUID;
  enrollment_id UUID;
  interview_id UUID;
  first_name TEXT;
  last_name TEXT;
  email TEXT;
  email_first TEXT;
  email_last TEXT;
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

    -- Generate unique email (transliterated for email format)
    -- Use person number for uniqueness
    email := 'test.person.' || i || '@testdata.hkf';

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
      IF random() < 0.3 THEN tags := array_append(tags, 'עדיפות'); END IF;
      IF random() < 0.2 THEN tags := array_append(tags, 'הפניה'); END IF;
      IF random() < 0.2 THEN tags := array_append(tags, 'חוזר'); END IF;
    END IF;

    -- Generate metadata based on profile type
    IF profile_type = 1 THEN
      metadata := jsonb_build_object(
        'source', sources[1 + floor(random() * array_length(sources, 1))],
        'city', cities[1 + floor(random() * array_length(cities, 1))],
        'occupation', occupations[1 + floor(random() * array_length(occupations, 1))],
        'age', 22 + floor(random() * 40),
        'notes', 'נתוני בדיקה עבור מערכת HKF CRM'
      );
    ELSIF profile_type = 2 THEN
      metadata := jsonb_build_object(
        'source', sources[1 + floor(random() * array_length(sources, 1))],
        'notes', 'נתוני בדיקה - פרופיל חלקי'
      );
    ELSE
      metadata := jsonb_build_object('notes', 'נתוני בדיקה - פרופיל מינימלי');
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
            'motivation', motivations[1 + floor(random() * array_length(motivations, 1))],
            'experience', experiences[1 + floor(random() * array_length(experiences, 1))],
            'goals', ARRAY['נטוורקינג', 'פיתוח מיומנויות', 'צמיחה בקריירה']
          )
          WHEN profile_type = 2 THEN jsonb_build_object(
            'motivation', 'מעוניין/ת בפיתוח מנהיגות.'
          )
          ELSE '{}'::jsonb
        END,
        NOW() - (random() * interval '60 days'),
        CASE WHEN enrollment_status = 'enrolled' THEN NOW() - (random() * interval '14 days') ELSE NULL END,
        NOW() - (random() * interval '60 days'),
        NOW() - (random() * interval '14 days')
      );

      -- Create interviews for people in interviewing, accepted, rejected, or enrolled status
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
            WHEN 0 THEN 'זום'
            WHEN 1 THEN 'טלפון'
            ELSE 'פגישה במשרד'
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
            interview_notes_arr[1 + floor(random() * array_length(interview_notes_arr, 1))]
          ELSE NULL END,
          CASE WHEN enrollment_status != 'interviewing' THEN
            jsonb_build_object(
              'score', 5 + floor(random() * 6), -- Score 5-10
              'strengths', ARRAY[
                strengths_arr[1 + floor(random() * array_length(strengths_arr, 1))],
                strengths_arr[1 + floor(random() * array_length(strengths_arr, 1))]
              ],
              'concerns', CASE WHEN random() < 0.3 THEN ARRAY[concerns_arr[1 + floor(random() * array_length(concerns_arr, 1))]] ELSE ARRAY[]::TEXT[] END,
              'recommendation', CASE
                WHEN enrollment_status IN ('accepted', 'enrolled') THEN 'לקבל'
                WHEN enrollment_status = 'rejected' THEN 'לדחות'
                ELSE 'אולי'
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
          180000, -- 1800.00 ILS in agorot
          'ILS',
          'קורס מנהיגות 2025 - דמי השתתפות',
          CASE
            WHEN enrollment_status = 'enrolled' THEN 'completed'
            ELSE CASE WHEN random() < 0.5 THEN 'pending' ELSE 'completed' END
          END,
          'meshulam',
          CASE floor(random() * 2)
            WHEN 0 THEN 'כרטיס אשראי'
            ELSE 'העברה בנקאית'
          END,
          CASE WHEN enrollment_status = 'enrolled' OR random() < 0.5 THEN NOW() - (random() * interval '14 days') ELSE NULL END,
          NOW() - (random() * interval '30 days'),
          NOW() - (random() * interval '7 days')
        );
      END IF;

    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully created 100 test people with Hebrew data';
END $$;
