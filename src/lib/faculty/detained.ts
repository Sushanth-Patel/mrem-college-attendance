import { createClient } from '@/lib/supabase/server'
import { requireFaculty } from '@/lib/auth/guards'
import { logAudit } from '@/lib/audit-log'

export async function listDetainedStudentsForFaculty() {
  const faculty = await requireFaculty()
  const supabase = await createClient()

  const { data: sectionSubjects, error: sectionSubjectsError } = await supabase
    .from('section_subjects')
    .select('section_id')
    .eq('default_faculty_id', faculty.id)

  if (sectionSubjectsError) throw sectionSubjectsError

  const sectionIds = [...new Set((sectionSubjects ?? []).map((row) => row.section_id))]
  if (sectionIds.length === 0) return []

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, roll_no, section_id, account_status, profiles(full_name)')
    .in('section_id', sectionIds)
    .eq('account_status', 'detained')
    .order('roll_no')

  if (studentsError) throw studentsError

  return (students ?? []).map((student) => ({
    id: student.id,
    rollNo: student.roll_no,
    sectionId: student.section_id,
    fullName: (student.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
  }))
}

export async function releaseDetainedStudent(studentId: string) {
  await requireFaculty()
  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, account_status')
    .eq('id', studentId)
    .single()

  if (studentError || !student) throw studentError ?? new Error('Student not found')
  if (student.account_status !== 'detained') {
    throw new Error('Only detained students can be released by faculty')
  }

  const { error: updateError } = await supabase
    .from('students')
    .update({ account_status: 'active' })
    .eq('id', studentId)
    .eq('account_status', 'detained')
  if (updateError) throw updateError

  await logAudit({
    studentId,
    fieldChanged: 'account_status',
    oldValue: 'detained',
    newValue: 'active',
    reason: 'faculty_release',
  })
}
