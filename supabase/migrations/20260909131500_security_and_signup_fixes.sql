-- Security and signup corrections for PRD v2.4.1.

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS term_start_date DATE;

CREATE OR REPLACE FUNCTION public.find_student_roster_for_signup(
  p_roll_no TEXT,
  p_email TEXT
)
RETURNS TABLE (
  roll_no TEXT,
  full_name TEXT,
  email TEXT,
  section_id UUID,
  term_start_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rs.roll_no, rs.full_name, rs.email, rs.section_id, s.term_start_date
  FROM public.roster_students rs
  JOIN public.sections s ON s.id = rs.section_id
  WHERE upper(rs.roll_no) = upper(trim(p_roll_no))
    AND lower(rs.email) = lower(trim(p_email))
    AND s.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.find_faculty_roster_for_signup(
  p_employee_id TEXT,
  p_email TEXT
)
RETURNS TABLE (
  employee_id TEXT,
  full_name TEXT,
  email TEXT,
  branch_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rf.employee_id, rf.full_name, rf.email, rf.branch_id
  FROM public.roster_faculty rf
  WHERE upper(rf.employee_id) = upper(trim(p_employee_id))
    AND lower(rf.email) = lower(trim(p_email));
$$;

REVOKE ALL ON FUNCTION public.find_student_roster_for_signup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_student_roster_for_signup(TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.find_faculty_roster_for_signup(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_faculty_roster_for_signup(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'attendance_audit_log is append-only';
END;
$$;

CREATE TRIGGER attendance_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.attendance_audit_log
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.enforce_student_faculty_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() = 'faculty' THEN
    IF OLD.account_status <> 'detained'
       OR NEW.account_status <> 'active'
       OR NEW.id <> OLD.id
       OR NEW.roll_no <> OLD.roll_no
       OR NEW.section_id <> OLD.section_id
       OR NEW.attendance_flag <> OLD.attendance_flag
       OR NEW.joining_date <> OLD.joining_date THEN
      RAISE EXCEPTION 'Faculty may only release detained students';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER students_faculty_update_guard
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_faculty_update();

ALTER TABLE public.attendance_audit_log
  ADD CONSTRAINT attendance_audit_admin_unlock_reason
  CHECK (
    field_changed <> 'admin_unlocked'
    OR NULLIF(trim(reason), '') IS NOT NULL
  );
