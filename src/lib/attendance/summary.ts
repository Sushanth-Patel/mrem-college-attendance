import { createClient } from '@/lib/supabase/server'

export type SubjectAttendanceRow = {
  studentId: string
  subjectId: string
  periodsHeld: number
  periodsAttended: number
  attendancePct: number | null
}

/**
 * Per-student, per-subject attendance with PRD §6.3 semantics: a session counts
 * as held for a student when that student has their own attendance record in it
 * (denominator = recorded periods; numerator = those marked present).
 * Excused is stored and displayed distinctly but counts the same as absent:
 * it sits in the denominator and never the numerator (confirmed PRD rule —
 * an excused absence never inflates the percentage; reports show the split).
 * Unmarked future/idle sessions — including ones pre-created by /today — never
 * count against anyone. Cancelled/holiday sessions are excluded entirely, and
 * everything before the student's joining_date is excluded (PRD §6.11).
 *
 * The joining-date filter runs in JS because supabase-js cannot express a
 * column-to-column date comparison.
 */
export async function fetchStudentSubjectAttendance(
  filters: { studentId?: string; studentIds?: string[]; subjectIds?: string[] } = {}
): Promise<SubjectAttendanceRow[]> {
  const supabase = await createClient()

  // Exclude-list, not allow-list: only cancelled/holiday sessions drop out of
  // the denominator (PRD §5.4). Matching on status = 'scheduled' instead would
  // silently erase every marked session's attendance the moment a session is
  // moved to 'completed' — a status the enum, setSessionStatus() and the
  // marking flow all legitimately use.
  let query = supabase
    .from('attendance_records')
    .select('student_id, status, sessions!inner(subject_id, session_date)')
    .not('sessions.status', 'in', '("cancelled","holiday")')

  if (filters.studentId) query = query.eq('student_id', filters.studentId)
  if (filters.studentIds) {
    if (filters.studentIds.length === 0) return []
    query = query.in('student_id', filters.studentIds)
  }
  if (filters.subjectIds) {
    if (filters.subjectIds.length === 0) return []
    query = query.in('sessions.subject_id', filters.subjectIds)
  }

  const { data, error } = await query
  if (error) throw error

  const recordCount = (data ?? []).length
  if (recordCount === 0) return []

  // One students lookup for the joining-date filter (PRD §6.12).
  const referencedStudentIds = [...new Set((data ?? []).map((row) => row.student_id))]
  const { data: studentRows, error: studentsError } = await supabase
    .from('students')
    .select('id, joining_date')
    .in('id', referencedStudentIds)
  if (studentsError) throw studentsError
  const joiningDateByStudent = new Map((studentRows ?? []).map((s) => [s.id, s.joining_date]))

  const counts = new Map<string, { held: number; attended: number }>()
  for (const row of data ?? []) {
    const session = row.sessions as unknown as { subject_id: string | null; session_date: string } | null
    const subjectId = session?.subject_id
    if (!subjectId) continue
    const joiningDate = joiningDateByStudent.get(row.student_id)
    if (joiningDate && session.session_date < joiningDate) continue

    // Excused counts the same as absent (PRD §6.3): in the denominator,
    // never the numerator — an excused absence is a non-attended period.
    const key = `${row.student_id}:${subjectId}`
    const entry = counts.get(key) ?? { held: 0, attended: 0 }
    entry.held += 1
    if (row.status === 'present') entry.attended += 1
    counts.set(key, entry)
  }

  return [...counts.entries()].map(([key, counts]) => {
    const [studentId, subjectId] = key.split(':')
    return {
      studentId,
      subjectId,
      periodsHeld: counts.held,
      periodsAttended: counts.attended,
      attendancePct: Number(((counts.attended * 100) / counts.held).toFixed(2)),
    }
  })
}
