import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { formatIST } from '@/lib/timezone'

export type PastSessionItem = {
  sessionId: string
  sessionDate: string
  periodNumber: number | null
  status: string
  markedAt: string | null
  markedAtDisplay: string | null
  sectionId: string
  sectionName: string
  yearOfStudy: number
  branchCode: string
  subjectId: string | null
  subjectCode: string
  subjectName: string
  totalCount: number
  presentCount: number
  absentCount: number
  excusedCount: number
  attendancePct: number
  canEdit: boolean
}

export type FacultyHistoryFilterOptions = {
  subjects: { id: string; code: string; name: string }[]
  sections: { id: string; name: string; year: number }[]
}

export async function getFacultyAttendanceHistory() {
  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw new Error('Only faculty and administrators can view attendance history')
  }

  const supabase = await createClient()

  // 1. Determine subjects taught by this faculty (or all for admin)
  let taughtSubjectIds: string[] = []
  if (user.role === 'faculty') {
    const { data: ttData } = await supabase
      .from('timetable_entries')
      .select('subject_id')
      .eq('default_faculty_id', user.id)
    taughtSubjectIds = [...new Set((ttData ?? []).map((t) => t.subject_id).filter(Boolean) as string[])]
  }

  // 2. Fetch sessions that have attendance records
  const { data: recordSessions, error: recordError } = await supabase
    .from('attendance_records')
    .select('session_id')
  if (recordError) throw recordError

  const markedSessionIds = [...new Set((recordSessions ?? []).map((r) => r.session_id))]

  if (markedSessionIds.length === 0) {
    return { sessions: [], filterOptions: { subjects: [], sections: [] } }
  }

  // 3. Query the marked sessions with their section and subject joins
  let sessionQuery = supabase
    .from('sessions')
    .select(`
      id,
      session_date,
      period_number,
      status,
      marked_at,
      actual_faculty_id,
      subject_id,
      section_id,
      sections(id, section_name, year_of_study, branches(code)),
      subjects(id, code, name)
    `)
    .in('id', markedSessionIds)
    .order('session_date', { ascending: false })
    .order('period_number', { ascending: false })

  // Faculty can see sessions they marked or sessions for subjects they teach
  if (user.role === 'faculty') {
    if (taughtSubjectIds.length > 0) {
      sessionQuery = sessionQuery.or(
        `actual_faculty_id.eq.${user.id},subject_id.in.(${taughtSubjectIds.join(',')})`
      )
    } else {
      sessionQuery = sessionQuery.eq('actual_faculty_id', user.id)
    }
  }

  const { data: sessions, error: sessionsError } = await sessionQuery
  if (sessionsError) throw sessionsError

  if (!sessions || sessions.length === 0) {
    return { sessions: [], filterOptions: { subjects: [], sections: [] } }
  }

  // 4. Aggregate attendance counts per session
  const validSessionIds = sessions.map((s) => s.id)
  const { data: records, error: recordsCountError } = await supabase
    .from('attendance_records')
    .select('session_id, status')
    .in('session_id', validSessionIds)

  if (recordsCountError) throw recordsCountError

  const countsBySession = new Map<
    string,
    { total: number; present: number; absent: number; excused: number }
  >()

  for (const r of records ?? []) {
    const curr = countsBySession.get(r.session_id) ?? { total: 0, present: 0, absent: 0, excused: 0 }
    curr.total += 1
    if (r.status === 'present') curr.present += 1
    else if (r.status === 'absent') curr.absent += 1
    else if (r.status === 'excused') curr.excused += 1
    countsBySession.set(r.session_id, curr)
  }

  const subjectMap = new Map<string, { id: string; code: string; name: string }>()
  const sectionMap = new Map<string, { id: string; name: string; year: number }>()

  const mappedSessions: PastSessionItem[] = sessions.map((s) => {
    const counts = countsBySession.get(s.id) ?? { total: 0, present: 0, absent: 0, excused: 0 }
    const sec = s.sections as unknown as {
      id: string
      section_name: string
      year_of_study: number
      branches: { code: string } | null
    } | null
    const sub = s.subjects as unknown as { id: string; code: string; name: string } | null

    const subjectCode = sub?.code ?? 'GEN'
    const subjectName = sub?.name ?? 'General Session'
    const sectionName = sec?.section_name ?? 'Section'
    const yearOfStudy = sec?.year_of_study ?? 1
    const branchCode = sec?.branches?.code ?? 'ENGG'

    if (sub?.id) {
      subjectMap.set(sub.id, { id: sub.id, code: subjectCode, name: subjectName })
    }
    if (sec?.id) {
      sectionMap.set(sec.id, { id: sec.id, name: `${branchCode} Yr${yearOfStudy}-${sectionName}`, year: yearOfStudy })
    }

    const pct = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0

    const canEdit =
      user.role === 'admin' ||
      s.actual_faculty_id === user.id ||
      (s.subject_id !== null && taughtSubjectIds.includes(s.subject_id))

    return {
      sessionId: s.id,
      sessionDate: s.session_date,
      periodNumber: s.period_number,
      status: s.status,
      markedAt: s.marked_at,
      markedAtDisplay: s.marked_at ? formatIST(s.marked_at, 'dd MMM yyyy, hh:mm a') : null,
      sectionId: s.section_id,
      sectionName: `${branchCode} Year ${yearOfStudy} - Sec ${sectionName}`,
      yearOfStudy,
      branchCode,
      subjectId: s.subject_id,
      subjectCode,
      subjectName,
      totalCount: counts.total,
      presentCount: counts.present,
      absentCount: counts.absent,
      excusedCount: counts.excused,
      attendancePct: pct,
      canEdit,
    }
  })

  return {
    sessions: mappedSessions,
    filterOptions: {
      subjects: Array.from(subjectMap.values()),
      sections: Array.from(sectionMap.values()),
    },
  }
}
