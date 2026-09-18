import { createClient } from '@/lib/supabase/server'
import { requireFaculty } from '@/lib/auth/guards'
import { logAudit } from '@/lib/audit-log'

/**
 * Set or clear a student's irregular flag (PRD §6.10).
 * Faculty can toggle this for any student in sections they teach.
 */
export async function setStudentIrregularFlag(
  studentId: string,
  flag: 'regular' | 'irregular'
) {
  const faculty = await requireFaculty()
  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, attendance_flag, section_id')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    throw studentError ?? new Error('Student not found')
  }

  if (student.attendance_flag === flag) return // No change needed

  // Verify faculty teaches in this section
  const { data: sectionSubjects, error: ssError } = await supabase
    .from('section_subjects')
    .select('id')
    .eq('section_id', student.section_id)
    .eq('default_faculty_id', faculty.id)
    .limit(1)

  if (ssError) throw ssError
  if (!sectionSubjects || sectionSubjects.length === 0) {
    throw new Error('Faculty does not teach in this student\'s section')
  }

  const { error: updateError } = await supabase
    .from('students')
    .update({ attendance_flag: flag })
    .eq('id', studentId)

  if (updateError) throw updateError

  await logAudit({
    studentId,
    fieldChanged: 'attendance_flag',
    oldValue: student.attendance_flag,
    newValue: flag,
  })
}
