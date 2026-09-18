-- =========================================================
-- MREM / MRECMS College Attendance System — MASTER SCHEMA
-- Official Portal: Malla Reddy Engineering College & Management Sciences
-- Website: https://mrem.ac.in/ | EAMCET Code: MREM | Hyderabad, Telangana
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== USERS & AUTH ==========
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
    CREATE TYPE signup_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_role user_role NOT NULL,
    submitted_name TEXT NOT NULL,
    submitted_id TEXT NOT NULL,
    submitted_email TEXT NOT NULL,
    matched_roster_id TEXT,
    otp_verified BOOLEAN NOT NULL DEFAULT false,
    status signup_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- ========== ORGANIZATIONAL HIERARCHY ==========
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

DO $$ BEGIN
    CREATE TYPE semester_type AS ENUM ('odd', 'even');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    semester semester_type NOT NULL,
    academic_year TEXT NOT NULL,
    section_name TEXT NOT NULL,
    term_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, year_of_study, semester, academic_year, section_name)
);

DO $$ BEGIN
    CREATE TYPE attendance_flag_type AS ENUM ('regular', 'irregular');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE student_account_status AS ENUM ('active', 'detained', 'transferred');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    roll_no TEXT NOT NULL UNIQUE,
    section_id UUID NOT NULL REFERENCES sections(id),
    account_status student_account_status NOT NULL DEFAULT 'active',
    attendance_flag attendance_flag_type NOT NULL DEFAULT 'regular',
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS faculty (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL UNIQUE,
    branch_id UUID REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS roster_students (
    roll_no TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    section_id UUID NOT NULL REFERENCES sections(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    reviewed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS roster_faculty (
    employee_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    branch_id UUID REFERENCES branches(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    reviewed BOOLEAN NOT NULL DEFAULT false
);

-- ========== OTP CODES TABLE ==========
CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== SUBJECTS ==========
DO $$ BEGIN
    CREATE TYPE subject_type AS ENUM ('theory', 'lab', 'project');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL,
    semester semester_type NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    subject_type subject_type NOT NULL,
    credits SMALLINT NOT NULL DEFAULT 3,
    UNIQUE (branch_id, year_of_study, semester, code)
);

CREATE TABLE IF NOT EXISTS section_subjects (
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (section_id, subject_id)
);

-- ========== TIMETABLE ==========
CREATE TABLE IF NOT EXISTS period_slots (
    period_number SMALLINT PRIMARY KEY CHECK (period_number BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

DO $$ BEGIN
    CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    period_number SMALLINT NOT NULL REFERENCES period_slots(period_number),
    -- Nullable: non-academic slots (Library/Sports) and admin-authored
    -- display grids have no subjects row; such slots never open sessions.
    subject_id UUID REFERENCES subjects(id),
    default_faculty_id UUID REFERENCES faculty(id),
    subject_name TEXT,
    subject_code TEXT,
    faculty_name TEXT,
    room_no TEXT,
    is_lab BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (section_id, day_of_week, period_number)
);

-- ========== SESSIONS & ATTENDANCE ==========
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    session_date DATE NOT NULL,
    period_number SMALLINT NOT NULL REFERENCES period_slots(period_number),
    actual_faculty_id UUID REFERENCES faculty(id),
    is_admin_marked BOOLEAN NOT NULL DEFAULT false,
    marked_at TIMESTAMPTZ,
    status session_status NOT NULL DEFAULT 'scheduled',
    edit_window_override BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (section_id, session_date, period_number)
);

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status attendance_status NOT NULL,
    UNIQUE (session_id, student_id)
);

-- ========== AUDIT LOG ==========
DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'attendance_marked',
        'attendance_edited',
        'admin_override',
        'detained_override',
        'student_status_changed',
        'irregular_flag_changed',
        'joining_date_changed',
        'roster_uploaded',
        'timetable_created',
        'timetable_updated',
        'alert_triggered',
        'session_cancelled',
        'signup_approved',
        'signup_rejected',
        'system_reset'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_by UUID NOT NULL REFERENCES profiles(id),
    action audit_action NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT,
    old_value JSONB,
    new_value JSONB,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address INET
);

-- ========== SEED DATA: OFFICIAL MREM BRANCHES ==========
INSERT INTO branches (name, code) VALUES
('Computer Science and Engineering', 'CSE'),
('CSE - Artificial Intelligence & Machine Learning', 'CSE-AIML'),
('CSE - Data Science', 'CSE-DS'),
('CSE - Cyber Security', 'CSE-CS'),
('Information Technology', 'IT'),
('Electronics & Communication Engineering', 'ECE'),
('Electrical & Electronics Engineering', 'EEE'),
('Mechanical Engineering', 'MECH'),
('Civil Engineering', 'CIVIL'),
('Master of Business Administration', 'MBA')
ON CONFLICT (code) DO NOTHING;

-- Seed 7 Official Period Slots (09:30 AM to 04:10 PM IST)
INSERT INTO period_slots (period_number, start_time, end_time) VALUES
(1, '09:30:00', '10:20:00'),
(2, '10:20:00', '11:10:00'),
(3, '11:20:00', '12:10:00'),
(4, '12:10:00', '13:00:00'),
(5, '13:40:00', '14:30:00'),
(6, '14:30:00', '15:20:00'),
(7, '15:20:00', '16:10:00')
ON CONFLICT (period_number) DO NOTHING;

-- Seed Default Section A for CSE
DO $$
DECLARE
    cse_id UUID;
BEGIN
    SELECT id INTO cse_id FROM branches WHERE code = 'CSE' LIMIT 1;
    IF cse_id IS NOT NULL THEN
        INSERT INTO sections (branch_id, year_of_study, semester, academic_year, section_name, term_start_date)
        VALUES (cse_id, 4, 'odd', '2026-27', 'A', '2026-08-01')
        ON CONFLICT (branch_id, year_of_study, semester, academic_year, section_name) DO NOTHING;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS: role-aware policies (supersedes the earlier blanket
-- "USING (true)" policies). Helpers live in the non-exposed
-- `private` schema so they can read profiles without recursion
-- and are not callable through the Data API.
-- =========================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid()) AND p.role = 'admin' AND p.is_active
  )
$$;

CREATE OR REPLACE FUNCTION private.is_faculty()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid()) AND p.role = 'faculty' AND p.is_active
  )
$$;

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_faculty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_faculty() TO authenticated, service_role;

-- Alert queue (PRD §6.4) — client-driven resumable email sender
CREATE TABLE IF NOT EXISTS alert_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by UUID NOT NULL REFERENCES profiles(id),
    threshold_used NUMERIC(5,2) NOT NULL DEFAULT 75,
    section_id UUID REFERENCES sections(id),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES alert_batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, student_id)
);

ALTER TABLE alert_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Catalog reads: any authenticated user; writes: admins only
CREATE POLICY "profiles_read_authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_read_authenticated" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_read_authenticated" ON sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "subjects_read_authenticated" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "section_subjects_read_authenticated" ON section_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "period_slots_read_authenticated" ON period_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "timetable_entries_read_authenticated" ON timetable_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculty_read_authenticated" ON faculty FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "branches_admin_all" ON branches FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "sections_admin_all" ON sections FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "subjects_admin_all" ON subjects FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "section_subjects_admin_all" ON section_subjects FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "period_slots_admin_all" ON period_slots FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "timetable_entries_admin_all" ON timetable_entries FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "faculty_admin_all" ON faculty FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "signup_requests_admin_all" ON signup_requests FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "roster_students_admin_all" ON roster_students FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "roster_faculty_admin_all" ON roster_faculty FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- students: staff read the roster; students read only themselves; writes admin-only
CREATE POLICY "students_read_scoped" ON students FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR (select private.is_faculty())
    OR id = (select auth.uid())
  );
CREATE POLICY "students_admin_all" ON students FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- sessions: readable by all authenticated; staff write; admin-only delete
CREATE POLICY "sessions_read_authenticated" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert_staff" ON sessions FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "sessions_update_staff" ON sessions FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select private.is_faculty()))
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "sessions_delete_admin" ON sessions FOR DELETE TO authenticated
  USING ((select private.is_admin()));

-- attendance_records: staff manage; students read their own rows
CREATE POLICY "attendance_records_read_scoped" ON attendance_records FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR (select private.is_faculty())
    OR student_id = (select auth.uid())
  );
CREATE POLICY "attendance_records_insert_staff" ON attendance_records FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "attendance_records_update_staff" ON attendance_records FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select private.is_faculty()))
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "attendance_records_delete_admin" ON attendance_records FOR DELETE TO authenticated
  USING ((select private.is_admin()));

-- audit_log: append-only for staff, admin-readable
CREATE POLICY "audit_log_read_admin" ON audit_log FOR SELECT TO authenticated
  USING ((select private.is_admin()));
CREATE POLICY "audit_log_insert_staff" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = (select auth.uid())
    AND ((select private.is_admin()) OR (select private.is_faculty()))
  );

-- alert tables: admins only (the resumable alert sender runs as an admin)
CREATE POLICY "alert_batches_admin_all" ON alert_batches FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "alert_queue_admin_all" ON alert_queue FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- otp_codes: intentionally NO policies — service role only.

-- Supporting indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_sessions_section_date ON sessions (section_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records (student_id);
CREATE INDEX IF NOT EXISTS idx_students_section ON students (section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_section ON timetable_entries (section_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON audit_log (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_batch_pending ON alert_queue (batch_id) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_batches_triggered_by ON alert_batches (triggered_by);

