import { createClient } from '@/lib/supabase/server'
import { requireStudent } from '@/lib/auth/guards'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

export type StudentProfileInfo = {
  fullName: string
  rollNo: string
  email: string
  accountStatus: 'active' | 'detained' | 'transferred'
  branchName: string
  branchCode: string
  yearOfStudy: number
  semester: string
  sectionName: string
  academicYear: string
}

export type CourseAttendanceItem = {
  subjectId: string
  subjectCode: string
  subjectName: string
  periodsHeld: number
  periodsAttended: number
  attendancePct: number | null
  displayPct: string
  isShortage: boolean
}

export type AttendanceHistoryItem = {
  id: string
  status: string
  sessionDate: string | null
  sessionStatus: string
  periodNumber: number | null
  subjectId: string | null
  subjectCode: string
  subjectName: string
}

export async function getStudentDashboardData() {
  const studentUser = await requireStudent()
  const supabase = await createClient()

  // 1. Fetch Student Profile & Section/Branch metadata
  const studentProfilePromise = supabase
    .from('students')
    .select(`
      id,
      roll_no,
      account_status,
      joining_date,
      profiles(full_name, email),
      sections(
        id,
        section_name,
        year_of_study,
        semester,
        academic_year,
        branches(id, name, code)
      )
    `)
    .eq('id', studentUser.id)
    .maybeSingle()

  // 2. Fetch subject attendance summary rows
  const attendanceRowsPromise = fetchStudentSubjectAttendance({ studentId: studentUser.id })

  // 3. Fetch recent marked attendance records
  const historyQuery = supabase
    .from('attendance_records')
    .select('id, status, sessions!inner(session_date, status, subject_id, period_number)')
    .eq('student_id', studentUser.id)
    .order('sessions(session_date)', { ascending: false })
    .limit(250)

  const [
    { data: studentRow, error: studentError },
    attendanceRows,
    { data: historyRows, error: historyError },
  ] = await Promise.all([studentProfilePromise, attendanceRowsPromise, historyQuery])

  if (studentError) throw studentError
  if (historyError) throw historyError

  // Parse student academic profile
  const prof = studentRow?.profiles as unknown as { full_name: string; email: string } | null
  const sec = studentRow?.sections as unknown as {
    id: string
    section_name: string
    year_of_study: number
    semester: string
    academic_year: string
    branches: { name: string; code: string } | null
  } | null

  const yearRoman = ['I', 'II', 'III', 'IV'][sec?.year_of_study ? sec.year_of_study - 1 : 3] || 'IV'
  const semNum = (sec?.semester || '').toLowerCase().includes('ii') ? 'II' : 'I'
  const semShort = `${sec?.year_of_study || 4}-${semNum === 'II' ? '2' : '1'}`
  const formattedSemester = `${yearRoman} - ${semNum} (${semShort})`

  const studentProfile: StudentProfileInfo = {
    fullName: prof?.full_name || 'Student',
    rollNo: studentRow?.roll_no || 'Pending',
    email: prof?.email || '',
    accountStatus: (studentRow?.account_status as 'active' | 'detained' | 'transferred') || 'active',
    branchName: sec?.branches?.name || 'Computer Science & Engineering',
    branchCode: sec?.branches?.code || 'CSE',
    yearOfStudy: sec?.year_of_study || 4,
    semester: formattedSemester,
    sectionName: sec?.section_name || 'A',
    academicYear: sec?.academic_year || '2026-2027',
  }

  // 1. Fetch all subjects allocated to this section from section_subjects & timetable_entries
  let allSectionSubjects: { id: string; code: string; name: string }[] = []
  if (sec?.id) {
    const { data: secSubs } = await supabase
      .from('section_subjects')
      .select('subjects(id, code, name)')
      .eq('section_id', sec.id)

    if (secSubs && secSubs.length > 0) {
      allSectionSubjects = secSubs
        .map((ss: any) => ss.subjects)
        .filter((s: any): s is { id: string; code: string; name: string } => Boolean(s?.id))
    }

    // Fallback/enrich from timetable_entries
    const { data: ttSubs } = await supabase
      .from('timetable_entries')
      .select('subject_id, subject_code, subject_name')
      .eq('section_id', sec.id)
      .not('subject_id', 'is', null)

    const existingIds = new Set(allSectionSubjects.map((s) => s.id))
    for (const t of ttSubs ?? []) {
      if (t.subject_id && !existingIds.has(t.subject_id)) {
        existingIds.add(t.subject_id)
        allSectionSubjects.push({
          id: t.subject_id,
          code: t.subject_code,
          name: t.subject_name,
        })
      }
    }
  }

  // Map attendance rows by subjectId
  const attendanceMap = new Map<string, (typeof attendanceRows)[number]>()
  for (const row of attendanceRows) {
    attendanceMap.set(row.subjectId, row)
  }

  // Also include any subjects from attendanceRows not in timetable
  const subjectIds = [
    ...allSectionSubjects.map((s) => s.id),
    ...attendanceRows.map((row) => row.subjectId),
  ]

  const subjectNameById = new Map<string, { code: string; name: string }>()
  for (const s of allSectionSubjects) {
    subjectNameById.set(s.id, { code: s.code, name: s.name })
  }

  const missingIds = subjectIds.filter((id) => !subjectNameById.has(id))
  if (missingIds.length > 0) {
    const { data: extraSubjects } = await supabase
      .from('subjects')
      .select('id, code, name')
      .in('id', missingIds)
    for (const s of extraSubjects ?? []) {
      subjectNameById.set(s.id, { code: s.code, name: s.name })
      allSectionSubjects.push(s)
    }
  }

  // Build complete subject breakdown ensuring all timetable courses are present
  const subjectBreakdown: CourseAttendanceItem[] = allSectionSubjects.map((sub) => {
    const row = attendanceMap.get(sub.id)
    const periodsHeld = row?.periodsHeld ?? 0
    const periodsAttended = row?.periodsAttended ?? 0
    const attendancePct =
      periodsHeld > 0 ? Number(((periodsAttended * 100) / periodsHeld).toFixed(2)) : null
    const isShortage = attendancePct !== null && attendancePct < 75

    return {
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      periodsHeld,
      periodsAttended,
      attendancePct,
      displayPct: attendancePct === null ? '0.0%' : `${attendancePct}%`,
      isShortage,
    }
  })

  // Attendance calculated as all subjects total classes by the total classes attended by the student
  const totalHeld = subjectBreakdown.reduce((sum, row) => sum + row.periodsHeld, 0)
  const totalAttended = subjectBreakdown.reduce((sum, row) => sum + row.periodsAttended, 0)
  const totalMissed = Math.max(0, totalHeld - totalAttended)
  const overallPct = totalHeld === 0 ? null : Number(((totalAttended * 100) / totalHeld).toFixed(2))

  // Smart Academic Recovery & Bunk Calculator
  let classesToAttend = 0
  let classesCanMiss = 0
  if (overallPct !== null) {
    if (overallPct < 75) {
      // Need 75% -> (attended + x) / (held + x) >= 0.75
      classesToAttend = Math.max(0, Math.ceil((0.75 * totalHeld - totalAttended) / 0.25))
    } else {
      // Safe bunks remaining -> attended / (held + y) >= 0.75
      classesCanMiss = Math.max(0, Math.floor((totalAttended - 0.75 * totalHeld) / 0.75))
    }
  }

  // University Standing Tier
  let standingTier: 'good' | 'condonation' | 'critical' = 'good'
  let standingLabel = 'Exam Eligible'
  let standingDescription = 'You meet university attendance criteria for end-semester examinations.'
  if (overallPct !== null) {
    if (overallPct >= 75) {
      standingTier = 'good'
      standingLabel = 'Good Standing • Exam Eligible'
      standingDescription = 'Attendance meets the mandatory 75% threshold. You are fully qualified for end-semester examinations.'
    } else if (overallPct >= 65) {
      standingTier = 'condonation'
      standingLabel = 'Condonation Zone (65% – 74.9%)'
      standingDescription = 'Attendance is between 65% and 75%. Principal / HoD condonation with medical documentation required.'
    } else {
      standingTier = 'critical'
      standingLabel = 'Critical Shortage (< 65%)'
      standingDescription = 'Attendance is below the 65% university cutoff. Immediate attendance recovery required to prevent detention.'
    }
  }

  // Parse Complete History
  const allHistory: AttendanceHistoryItem[] = (historyRows ?? []).map((row) => {
    const session = row.sessions as unknown as
      | {
          session_date: string
          status: string
          subject_id: string | null
          period_number: number | null
        }
      | null
    const subjectId = session?.subject_id
    const subject = subjectId ? subjectNameById.get(subjectId) : null

    return {
      id: row.id,
      status: row.status,
      sessionDate: session?.session_date ?? null,
      sessionStatus: session?.status ?? 'normal',
      periodNumber: session?.period_number ?? null,
      subjectId: subjectId ?? null,
      subjectCode: subject?.code ?? '-',
      subjectName: subject?.name ?? 'Academic Class',
    }
  })

  return {
    studentProfile,
    totalHeld,
    totalAttended,
    totalMissed,
    overallPct,
    overallDisplayPct: overallPct === null ? 'N/A' : `${overallPct}%`,
    classesToAttend,
    classesCanMiss,
    standingTier,
    standingLabel,
    standingDescription,
    subjectBreakdown,
    history: allHistory.slice(0, 15),
    allHistory,
  }
}
