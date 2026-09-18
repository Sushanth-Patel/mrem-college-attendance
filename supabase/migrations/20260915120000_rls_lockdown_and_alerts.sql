-- ============================================================
-- RLS LOCKDOWN + ALERT QUEUE + TIMETABLE ALIGNMENT
-- ============================================================
-- Replaces the permissive "Admin Full Access ... USING (true)" policies
-- (which let ANY authenticated user write every table) with role-aware
-- policies. Also:
--   * enables RLS on every public table (deny-by-default),
--   * locks otp_codes to service-role only (no policies),
--   * creates the missing alert_batches / alert_queue tables (PRD §6.4),
--   * aligns timetable_entries with the app (optional subject/faculty id,
--     display columns for admin-authored timetables),
--   * adds FK/supporting indexes for the hot query paths.
--
-- Helpers live in the non-exposed `private` schema (SECURITY DEFINER) so
-- they can read profiles without triggering recursive RLS evaluation and
-- so they are NOT callable through the Data API.
-- ============================================================

-- ---------- 0. Helper schema & functions ----------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
      AND p.is_active
  )
$$;

CREATE OR REPLACE FUNCTION private.is_faculty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'faculty'
      AND p.is_active
  )
$$;

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_faculty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_faculty() TO authenticated, service_role;

-- ---------- 1. Alert queue tables (PRD §6.4) ----------
CREATE TABLE IF NOT EXISTS public.alert_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by UUID NOT NULL REFERENCES public.profiles(id),
    threshold_used NUMERIC(5,2) NOT NULL DEFAULT 75,
    section_id UUID REFERENCES public.sections(id),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.alert_batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, student_id)
);

-- ---------- 2. Align timetable_entries with the application ----------
-- The admin timetable builder stores display fields and may not resolve a
-- subjects row; the seed sets subject_id only for mapped grid labels.
ALTER TABLE public.timetable_entries ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE public.timetable_entries ALTER COLUMN default_faculty_id DROP NOT NULL;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS subject_name TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS subject_code TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS faculty_name TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS room_no TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS is_lab BOOLEAN NOT NULL DEFAULT false;

-- ---------- 3. Wipe every existing policy on the managed tables ----------
-- (removes ad-hoc/permissive policies that may exist on the live project)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'signup_requests', 'branches', 'sections', 'students',
        'faculty', 'roster_students', 'roster_faculty', 'otp_codes',
        'subjects', 'section_subjects', 'period_slots', 'timetable_entries',
        'sessions', 'attendance_records', 'audit_log',
        'alert_batches', 'alert_queue'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------- 4. Enable RLS everywhere (deny-by-default) ----------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_faculty    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_queue       ENABLE ROW LEVEL SECURITY;

-- ---------- 5. Policies ----------
-- Read catalogs: any authenticated user
CREATE POLICY "profiles_read_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_read_authenticated" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_read_authenticated" ON public.sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "subjects_read_authenticated" ON public.subjects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "section_subjects_read_authenticated" ON public.section_subjects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "period_slots_read_authenticated" ON public.period_slots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "timetable_entries_read_authenticated" ON public.timetable_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculty_read_authenticated" ON public.faculty
  FOR SELECT TO authenticated USING (true);

-- Catalog writes: admins only
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "branches_admin_all" ON public.branches
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "sections_admin_all" ON public.sections
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "subjects_admin_all" ON public.subjects
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "section_subjects_admin_all" ON public.section_subjects
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "period_slots_admin_all" ON public.period_slots
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "timetable_entries_admin_all" ON public.timetable_entries
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "faculty_admin_all" ON public.faculty
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "signup_requests_admin_all" ON public.signup_requests
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "roster_students_admin_all" ON public.roster_students
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "roster_faculty_admin_all" ON public.roster_faculty
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- students: faculty/admin read roster; students read only themselves.
-- All writes are admin-only (self-service profile edits go through the
-- server's service-role client, so no user-scoped write policy is needed).
CREATE POLICY "students_read_scoped" ON public.students
  FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR (select private.is_faculty())
    OR id = (select auth.uid())
  );
CREATE POLICY "students_admin_all" ON public.students
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- sessions: everyone authenticated can read the schedule; faculty/admin write
CREATE POLICY "sessions_read_authenticated" ON public.sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert_staff" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "sessions_update_staff" ON public.sessions
  FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select private.is_faculty()))
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "sessions_delete_admin" ON public.sessions
  FOR DELETE TO authenticated
  USING ((select private.is_admin()));

-- attendance_records: staff manage; students read their own rows
CREATE POLICY "attendance_records_read_scoped" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR (select private.is_faculty())
    OR student_id = (select auth.uid())
  );
CREATE POLICY "attendance_records_insert_staff" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "attendance_records_update_staff" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select private.is_faculty()))
  WITH CHECK ((select private.is_admin()) OR (select private.is_faculty()));
CREATE POLICY "attendance_records_delete_admin" ON public.attendance_records
  FOR DELETE TO authenticated
  USING ((select private.is_admin()));

-- audit_log: append-only; admins read
CREATE POLICY "audit_log_read_admin" ON public.audit_log
  FOR SELECT TO authenticated
  USING ((select private.is_admin()));
CREATE POLICY "audit_log_insert_staff" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = (select auth.uid())
    AND ((select private.is_admin()) OR (select private.is_faculty()))
  );

-- alert tables: admins only (client-driven alert sender runs as an admin)
CREATE POLICY "alert_batches_admin_all" ON public.alert_batches
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));
CREATE POLICY "alert_queue_admin_all" ON public.alert_queue
  FOR ALL TO authenticated
  USING ((select private.is_admin())) WITH CHECK ((select private.is_admin()));

-- otp_codes: intentionally NO policies — service role only.
-- (RLS enabled above; user roles are denied everything.)

-- ---------- 6. Supporting indexes for hot paths ----------
CREATE INDEX IF NOT EXISTS idx_sessions_section_date
  ON public.sessions (section_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON public.attendance_records (student_id);
CREATE INDEX IF NOT EXISTS idx_students_section
  ON public.students (section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_section
  ON public.timetable_entries (section_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at
  ON public.audit_log (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_batch_pending
  ON public.alert_queue (batch_id) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_batches_triggered_by
  ON public.alert_batches (triggered_by);
