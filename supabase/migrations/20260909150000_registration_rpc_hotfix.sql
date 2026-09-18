-- Make exact roster-matched signup lookups available on the existing production schema.
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
