import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

export type DetainedStudentItem = {
  id: string
  rollNo: string
  fullName: string
  email: string
  sectionId: string
  sectionName: string
  yearOfStudy: number
  semester: string
  branchName: string
  branchCode: string
  accountStatus: 'detained' | 'active' | 'transferred'
  overallPct: number | null
  periodsHeld: number
  periodsAttended: number
  shortagePct: number
  category: 'critical' | 'condonation' | 'normal'
}

export async function getDetainedStudentsList(filters?: {
  branchId?: string
  yearOfStudy?: number
  sectionId?: string
  status?: 'detained' | 'active' | 'all'
}): Promise<DetainedStudentItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from('students')
    .select(`
      id,
      roll_no,
      account_status,
      attendance_flag,
      profiles(full_name, email),
      sections!inner(
        id,
        section_name,
        year_of_study,
        semester,
        branch_id,
        branches(id, name, code)
      )
    `)
    .order('roll_no')

  // Status filter (defaults to detained only)
  const targetStatus = filters?.status ?? 'detained'
  if (targetStatus !== 'all') {
    query = query.eq('account_status', targetStatus)
  }

  if (filters?.sectionId) {
    query = query.eq('section_id', filters.sectionId)
  }
  if (filters?.yearOfStudy) {
    query = query.eq('sections.year_of_study', filters.yearOfStudy)
  }
  if (filters?.branchId) {
    query = query.eq('sections.branch_id', filters.branchId)
  }

  const { data: rows, error } = await query
  if (error) throw error

  if (!rows || rows.length === 0) {
    return []
  }

  const studentIds = rows.map((r) => r.id)
  const attendanceRows = await fetchStudentSubjectAttendance({ studentIds })

  // Aggregate attendance by student
  const statsByStudent = new Map<string, { held: number; attended: number }>()
  for (const att of attendanceRows) {
    const curr = statsByStudent.get(att.studentId) ?? { held: 0, attended: 0 }
    curr.held += att.periodsHeld
    curr.attended += att.periodsAttended
    statsByStudent.set(att.studentId, curr)
  }

  return rows.map((row) => {
    const prof = row.profiles as unknown as { full_name: string; email: string } | null
    const sec = row.sections as unknown as {
      id: string
      section_name: string
      year_of_study: number
      semester: string
      branch_id: string
      branches: { id: string; name: string; code: string } | null
    } | null

    const stats = statsByStudent.get(row.id) ?? { held: 0, attended: 0 }
    const overallPct = stats.held === 0 ? null : Number(((stats.attended * 100) / stats.held).toFixed(1))
    const shortagePct = overallPct !== null && overallPct < 75 ? Number((75 - overallPct).toFixed(1)) : 0

    let category: 'critical' | 'condonation' | 'normal' = 'normal'
    if (overallPct !== null) {
      if (overallPct < 65) category = 'critical'
      else if (overallPct < 75) category = 'condonation'
    }

    return {
      id: row.id,
      rollNo: row.roll_no,
      fullName: prof?.full_name || 'Student',
      email: prof?.email || '',
      sectionId: sec?.id || '',
      sectionName: sec?.section_name || 'A',
      yearOfStudy: sec?.year_of_study || 1,
      semester: sec?.semester || 'Semester I',
      branchName: sec?.branches?.name || 'Engineering',
      branchCode: sec?.branches?.code || 'CSE',
      accountStatus: row.account_status as 'detained' | 'active' | 'transferred',
      overallPct,
      periodsHeld: stats.held,
      periodsAttended: stats.attended,
      shortagePct,
      category,
    }
  })
}

export async function updateStudentDetentionStatus(args: {
  studentId: string
  newStatus: 'active' | 'detained'
  reason?: string
}) {
  await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({
      account_status: args.newStatus,
    })
    .eq('id', args.studentId)

  if (error) throw error

  return { success: true }
}
