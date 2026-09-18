-- Compatibility view for the current production schema.
CREATE OR REPLACE VIEW public.student_subject_attendance
WITH (security_invoker = true)
AS
SELECT
  s.id AS student_id,
  sess.subject_id,
  count(sess.id)::integer AS periods_held,
  count(ar.id) FILTER (WHERE ar.status = 'present')::integer AS periods_attended,
  CASE
    WHEN count(sess.id) = 0 THEN NULL
    ELSE round(
      (count(ar.id) FILTER (WHERE ar.status = 'present'))::numeric * 100 / count(sess.id),
      2
    )
  END AS attendance_pct
FROM public.students s
JOIN public.sessions sess
  ON sess.section_id = s.section_id
  AND sess.session_date >= s.joining_date
  AND sess.status <> 'cancelled'
LEFT JOIN public.attendance_records ar
  ON ar.session_id = sess.id
  AND ar.student_id = s.id
GROUP BY s.id, sess.subject_id;

GRANT SELECT ON public.student_subject_attendance TO authenticated;
