-- Redefines the compatibility view so a session counts as held for a student
-- only when that student has their own attendance record in it (denominator =
-- recorded periods). Unmarked sessions pre-created by the /today page never
-- count against anyone; cancelled/holiday sessions are excluded; everything
-- before the student's joining_date is excluded (PRD §6.12).
--
-- The app's TypeScript path (src/lib/attendance/summary.ts) implements the
-- same semantics and is the read path in environments where this migration
-- has not been applied yet.

CREATE OR REPLACE VIEW public.student_subject_attendance
WITH (security_invoker = true)
AS
SELECT
  ar.student_id,
  sess.subject_id,
  count(*) FILTER (WHERE ar.status <> 'excused')::integer AS periods_held,
  count(*) FILTER (WHERE ar.status = 'present')::integer AS periods_attended,
  CASE
    WHEN count(*) FILTER (WHERE ar.status <> 'excused') = 0 THEN NULL
    ELSE round(
      (count(*) FILTER (WHERE ar.status = 'present'))::numeric * 100
      / count(*) FILTER (WHERE ar.status <> 'excused'),
      2
    )
  END AS attendance_pct
FROM public.attendance_records ar
JOIN public.sessions sess
  ON sess.id = ar.session_id
  AND sess.status <> 'cancelled'
JOIN public.students s
  ON s.id = ar.student_id
  AND sess.session_date >= s.joining_date
GROUP BY ar.student_id, sess.subject_id;

GRANT SELECT ON public.student_subject_attendance TO authenticated;
