-- College Attendance System (PRD v2.4.1)
-- Step 1: Complete schema + RLS + baseline indexes

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== USERS & AUTH ==========
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE signup_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_role user_role NOT NULL,
    submitted_name TEXT NOT NULL,
    submitted_id TEXT NOT NULL,
    submitted_email TEXT NOT NULL,
    matched_roster_id TEXT,
    status signup_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- ========== ORGANIZATIONAL HIERARCHY ==========
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

CREATE TYPE semester_type AS ENUM ('odd', 'even');

CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    semester semester_type NOT NULL,
    academic_year TEXT NOT NULL,
    section_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, year_of_study, semester, academic_year, section_name)
);

CREATE TYPE attendance_flag_type AS ENUM ('regular', 'irregular');
CREATE TYPE student_account_status AS ENUM ('active', 'detained', 'transferred');

CREATE TABLE students (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    roll_no TEXT NOT NULL UNIQUE,
    section_id UUID NOT NULL REFERENCES sections(id),
    account_status student_account_status NOT NULL DEFAULT 'active',
    attendance_flag attendance_flag_type NOT NULL DEFAULT 'regular',
    joining_date DATE NOT NULL
);

CREATE TABLE faculty (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL UNIQUE,
    branch_id UUID REFERENCES branches(id)
);

CREATE TABLE roster_students (
    roll_no TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    section_id UUID NOT NULL REFERENCES sections(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    reviewed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE roster_faculty (
    employee_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    branch_id UUID REFERENCES branches(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    reviewed BOOLEAN NOT NULL DEFAULT false
);

-- ========== SUBJECTS ==========
CREATE TYPE subject_type AS ENUM ('theory', 'lab', 'project');

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL,
    semester semester_type NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    subject_type subject_type NOT NULL,
    track_attendance BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, code)
);

CREATE TABLE section_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    default_faculty_id UUID NOT NULL REFERENCES faculty(id),
    UNIQUE (section_id, subject_id)
);

-- ========== TIMETABLE ==========
CREATE TABLE period_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_number SMALLINT NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    label TEXT
);

CREATE TYPE weekday AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat');

CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id),
    day_of_week weekday NOT NULL,
    period_slot_id UUID NOT NULL REFERENCES period_slots(id),
    section_subject_id UUID REFERENCES section_subjects(id),
    room TEXT,
    UNIQUE (section_id, day_of_week, period_slot_id)
);

-- ========== SESSIONS ==========
CREATE TYPE session_status AS ENUM ('normal', 'holiday', 'cancelled');

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id),
    session_date DATE NOT NULL,
    actual_faculty_id UUID REFERENCES faculty(id),
    status session_status NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (timetable_entry_id, session_date)
);

-- ========== ATTENDANCE ==========
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    student_id UUID NOT NULL REFERENCES students(id),
    status attendance_status NOT NULL,
    marked_by UUID NOT NULL REFERENCES profiles(id),
    marked_by_role user_role NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    admin_unlocked BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (session_id, student_id)
);

CREATE TABLE attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID REFERENCES attendance_records(id),
    student_id UUID REFERENCES students(id),
    changed_by UUID NOT NULL REFERENCES profiles(id),
    changed_by_role user_role NOT NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (attendance_record_id IS NOT NULL OR student_id IS NOT NULL)
);

-- ========== ALERTS ==========
CREATE TABLE alert_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by UUID NOT NULL REFERENCES profiles(id),
    threshold_used NUMERIC(5,2) NOT NULL,
    section_id UUID REFERENCES sections(id),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipient_count INT NOT NULL DEFAULT 0
);

CREATE TABLE alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES alert_batches(id),
    student_id UUID NOT NULL REFERENCES students(id),
    sent_at TIMESTAMPTZ,
    UNIQUE (batch_id, student_id)
);

-- ========== DERIVED VIEW ==========
CREATE VIEW student_subject_attendance AS
SELECT
    ar.student_id,
    ss.subject_id,
    COUNT(*) FILTER (WHERE s.status = 'normal') AS periods_held,
    COUNT(*) FILTER (WHERE s.status = 'normal' AND ar.status = 'present') AS periods_attended,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE s.status = 'normal' AND ar.status = 'present')
        / NULLIF(COUNT(*) FILTER (WHERE s.status = 'normal'), 0),
        2
    ) AS attendance_pct
FROM attendance_records ar
JOIN sessions s ON s.id = ar.session_id
JOIN students st ON st.id = ar.student_id
JOIN timetable_entries te ON te.id = s.timetable_entry_id
JOIN section_subjects ss ON ss.id = te.section_subject_id
WHERE s.session_date >= st.joining_date
  AND st.account_status IN ('active', 'detained')
GROUP BY ar.student_id, ss.subject_id;

-- ========== BASELINE INDEXES ==========
-- Unique constraints already create indexes; add only access-pattern indexes.
CREATE INDEX idx_signup_requests_status_created_at ON signup_requests(status, created_at);
CREATE INDEX idx_sections_branch_id ON sections(branch_id);
CREATE INDEX idx_students_section_id ON students(section_id);
CREATE INDEX idx_faculty_branch_id ON faculty(branch_id);
CREATE INDEX idx_subjects_branch_year_semester ON subjects(branch_id, year_of_study, semester);
CREATE INDEX idx_section_subjects_section_id ON section_subjects(section_id);
CREATE INDEX idx_section_subjects_default_faculty_id ON section_subjects(default_faculty_id);
CREATE INDEX idx_timetable_entries_section_subject_id ON timetable_entries(section_subject_id);
CREATE INDEX idx_sessions_session_date ON sessions(session_date);
CREATE INDEX idx_sessions_actual_faculty_id ON sessions(actual_faculty_id);
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_marked_by ON attendance_records(marked_by);
CREATE INDEX idx_attendance_audit_log_record_id ON attendance_audit_log(attendance_record_id);
CREATE INDEX idx_attendance_audit_log_student_changed_at ON attendance_audit_log(student_id, changed_at DESC);
CREATE INDEX idx_alert_queue_batch_sent_at ON alert_queue(batch_id, sent_at);

-- ========== RLS HELPERS ==========
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT public.current_user_role() = 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_faculty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT public.current_user_role() = 'faculty'), false);
$$;

CREATE OR REPLACE FUNCTION public.faculty_has_section(section_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.section_subjects ss
        WHERE ss.section_id = section_id_to_check
          AND ss.default_faculty_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.faculty_has_section_subject(section_subject_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.section_subjects ss
        WHERE ss.id = section_subject_id_to_check
          AND ss.default_faculty_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.faculty_has_session(session_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.sessions s
        JOIN public.timetable_entries te ON te.id = s.timetable_entry_id
        JOIN public.section_subjects ss ON ss.id = te.section_subject_id
        WHERE s.id = session_id_to_check
          AND ss.default_faculty_id = auth.uid()
    );
$$;

-- ========== ENABLE RLS ==========
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_queue ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES ==========
-- profiles
CREATE POLICY profiles_select_self_or_admin ON profiles
FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_insert_self_or_admin ON profiles
FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_self_or_admin ON profiles
FOR UPDATE USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- signup requests
CREATE POLICY signup_requests_insert_any_user ON signup_requests
FOR INSERT WITH CHECK (true);

CREATE POLICY signup_requests_admin_read_all ON signup_requests
FOR SELECT USING (public.is_admin());

CREATE POLICY signup_requests_admin_update_all ON signup_requests
FOR UPDATE USING (public.is_admin())
WITH CHECK (public.is_admin());

-- admin-owned masters
CREATE POLICY branches_admin_all ON branches
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY sections_admin_all ON sections
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY subjects_admin_all ON subjects
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY period_slots_admin_all ON period_slots
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY roster_students_admin_all ON roster_students
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY roster_faculty_admin_all ON roster_faculty
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- faculty/student/faculty table visibility
CREATE POLICY students_select_self_admin_or_scoped_faculty ON students
FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin()
    OR (public.is_faculty() AND public.faculty_has_section(section_id))
);

CREATE POLICY students_admin_insert ON students
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY students_admin_update ON students
FOR UPDATE USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY students_faculty_release_detained ON students
FOR UPDATE USING (
    public.is_faculty()
    AND account_status = 'detained'
    AND public.faculty_has_section(section_id)
)
WITH CHECK (
    public.is_faculty()
    AND account_status = 'active'
    AND public.faculty_has_section(section_id)
);

CREATE POLICY faculty_select_self_or_admin ON faculty
FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY faculty_admin_all_write ON faculty
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY faculty_admin_update ON faculty
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- section-subject scoping
CREATE POLICY section_subjects_admin_all ON section_subjects
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY section_subjects_faculty_select_assigned ON section_subjects
FOR SELECT USING (public.is_faculty() AND default_faculty_id = auth.uid());

CREATE POLICY timetable_entries_admin_all ON timetable_entries
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY timetable_entries_faculty_select_assigned ON timetable_entries
FOR SELECT USING (
    public.is_faculty()
    AND section_subject_id IS NOT NULL
    AND public.faculty_has_section_subject(section_subject_id)
);

CREATE POLICY sessions_admin_all ON sessions
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY sessions_faculty_select_assigned ON sessions
FOR SELECT USING (public.is_faculty() AND public.faculty_has_session(id));

-- attendance records
CREATE POLICY attendance_records_admin_all ON attendance_records
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY attendance_records_faculty_select_assigned ON attendance_records
FOR SELECT USING (public.is_faculty() AND public.faculty_has_session(session_id));

CREATE POLICY attendance_records_faculty_insert_assigned ON attendance_records
FOR INSERT WITH CHECK (
    public.is_faculty()
    AND public.faculty_has_session(session_id)
    AND marked_by = auth.uid()
    AND marked_by_role = 'faculty'
);

CREATE POLICY attendance_records_faculty_update_assigned ON attendance_records
FOR UPDATE USING (
    public.is_faculty()
    AND public.faculty_has_session(session_id)
)
WITH CHECK (
    public.is_faculty()
    AND public.faculty_has_session(session_id)
    AND marked_by = auth.uid()
    AND marked_by_role = 'faculty'
);

-- audit log
CREATE POLICY attendance_audit_log_admin_read_all ON attendance_audit_log
FOR SELECT USING (public.is_admin());

CREATE POLICY attendance_audit_log_admin_insert ON attendance_audit_log
FOR INSERT WITH CHECK (
    public.is_admin()
    AND changed_by = auth.uid()
    AND changed_by_role = 'admin'
);

CREATE POLICY attendance_audit_log_faculty_insert_scoped ON attendance_audit_log
FOR INSERT WITH CHECK (
    public.is_faculty()
    AND changed_by = auth.uid()
    AND changed_by_role = 'faculty'
    AND (
        (attendance_record_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.attendance_records ar
            WHERE ar.id = attendance_audit_log.attendance_record_id
              AND public.faculty_has_session(ar.session_id)
        ))
        OR
        (student_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.students st
            WHERE st.id = attendance_audit_log.student_id
              AND public.faculty_has_section(st.section_id)
        ))
    )
);

-- alerting (admin only)
CREATE POLICY alert_batches_admin_all ON alert_batches
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY alert_queue_admin_all ON alert_queue
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
