-- Verify PRD Section 8 schema objects exist and are typed correctly.

-- 1) Enums
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN (
    'user_role',
    'signup_status',
    'semester_type',
    'attendance_flag_type',
    'student_account_status',
    'subject_type',
    'weekday',
    'session_status',
    'attendance_status'
)
ORDER BY t.typname, e.enumsortorder;

-- 2) Tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'signup_requests',
    'branches',
    'sections',
    'students',
    'faculty',
    'roster_students',
    'roster_faculty',
    'subjects',
    'section_subjects',
    'period_slots',
    'timetable_entries',
    'sessions',
    'attendance_records',
    'attendance_audit_log',
    'alert_batches',
    'alert_queue'
)
ORDER BY table_name;

-- 3) Critical columns
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'sessions' AND column_name IN ('actual_faculty_id', 'status', 'session_date'))
    OR (table_name = 'attendance_records' AND column_name IN ('marked_by', 'marked_by_role', 'admin_unlocked'))
    OR (table_name = 'students' AND column_name IN ('account_status', 'attendance_flag', 'joining_date'))
    OR (table_name = 'attendance_audit_log' AND column_name IN ('attendance_record_id', 'student_id', 'changed_by_role'))
  )
ORDER BY table_name, column_name;

-- 4) View
SELECT table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'student_subject_attendance';

-- 5) RLS enabled tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles',
    'signup_requests',
    'branches',
    'sections',
    'students',
    'faculty',
    'roster_students',
    'roster_faculty',
    'subjects',
    'section_subjects',
    'period_slots',
    'timetable_entries',
    'sessions',
    'attendance_records',
    'attendance_audit_log',
    'alert_batches',
    'alert_queue'
)
ORDER BY c.relname;

-- 6) Policies list
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7) Indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_%'
    OR indexname LIKE '%_key'
    OR indexname LIKE '%_pkey'
  )
ORDER BY tablename, indexname;
