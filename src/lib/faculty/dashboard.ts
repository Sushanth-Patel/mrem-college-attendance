import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/server'
import { requireFaculty } from '@/lib/auth/guards'
import { getCurrentUser } from '@/lib/auth/session'
import { IST_TIMEZONE } from '@/lib/timezone'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

function getISTWeekday(): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  const day = formatInTimeZone(new Date(), IST_TIMEZONE, 'EEE').toLowerCase()
  const map: Record<string, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
  }
  return map[day] ?? 'monday'
}

export async function getFacultyTodaySchedule() {
  const faculty = await requireFaculty()
  const supabase = await createClient()

  // Sunday is a non-teaching day (Mon–Sat week, PRD §5) — no schedule exists
  if (formatInTimeZone(new Date(), IST_TIMEZONE, 'EEE').toLowerCase() === 'sun') {
    return []
  }

  const { data, error } = await supabase
    .from('timetable_entries')
    .select('id, day_of_week, room_no, period_number, section_id, subject_id, subject_code, subject_name, default_faculty_id, is_lab')
    .eq('day_of_week', getISTWeekday())
    .eq('default_faculty_id', faculty.id)

  if (error) throw error

  const subjectIds = [...new Set((data ?? []).map((row) => row.subject_id).filter(Boolean))]
  const { data: subjects, error: subjectsError } = subjectIds.length
    ? await supabase.from('subjects').select('id, code, name, subject_type').in('id', subjectIds)
    : { data: [], error: null }
  if (subjectsError) throw subjectsError

  const subjectsById = new Map((subjects ?? []).map((subject) => [subject.id, subject]))
  const periodTimes: Record<number, { start_time: string; end_time: string }> = {
    1: { start_time: '09:30:00', end_time: '10:20:00' },
    2: { start_time: '10:20:00', end_time: '11:10:00' },
    3: { start_time: '11:20:00', end_time: '12:10:00' },
    4: { start_time: '12:10:00', end_time: '13:00:00' },
    5: { start_time: '13:40:00', end_time: '14:30:00' },
    6: { start_time: '14:30:00', end_time: '15:20:00' },
    7: { start_time: '15:20:00', end_time: '16:10:00' },
  }

  return (data ?? []).map((row) => {
    const subject = subjectsById.get(row.subject_id)
    return {
      ...row,
      room: row.room_no,
      period_slots: { period_number: row.period_number, ...periodTimes[row.period_number] },
      section_subjects: {
        id: `${row.section_id}:${row.subject_id}`,
        section_id: row.section_id,
        default_faculty_id: row.default_faculty_id,
        subjects: {
          code: subject?.code ?? row.subject_code ?? 'SUB',
          name: subject?.name ?? row.subject_name ?? 'Assigned Course',
          subject_type: subject?.subject_type ?? (row.is_lab ? 'lab' : 'theory'),
        },
      },
    }
  })
}

export async function getFacultySubjectSummaries() {
  const faculty = await requireFaculty()
  const supabase = await createClient()

  const { data: timetableAssignments, error: assignmentsError } = await supabase
    .from('timetable_entries')
    .select('section_id, subject_id, subject_code, subject_name')
    .eq('default_faculty_id', faculty.id)

  if (assignmentsError) throw assignmentsError
  // Non-academic slots (LIBRARY, SPORTS…) have no subject — nothing to summarize.
  const assignments = Array.from(
    new Map(
      (timetableAssignments ?? [])
        .filter((assignment) => assignment.subject_id)
        .map((assignment) => [
          `${assignment.section_id}:${assignment.subject_id}`,
          assignment,
        ])
    ).values()
  )
  if (assignments.length === 0) return []

  const subjectIds = assignments.map((assignment) => assignment.subject_id)

  const attendanceRows = await fetchStudentSubjectAttendance({ subjectIds })

  const aggregate = new Map<string, { periodsHeld: number; periodsAttended: number }>()
  for (const row of attendanceRows) {
    const entry = aggregate.get(row.subjectId) ?? { periodsHeld: 0, periodsAttended: 0 }
    entry.periodsHeld += row.periodsHeld
    entry.periodsAttended += row.periodsAttended
    aggregate.set(row.subjectId, entry)
  }

  return assignments.map((assignment) => {
    const stats = aggregate.get(assignment.subject_id) ?? {
      periodsHeld: 0,
      periodsAttended: 0,
    }
    const attendancePct =
      stats.periodsHeld === 0 ? null : Number(((stats.periodsAttended * 100) / stats.periodsHeld).toFixed(2))

    return {
      subjectId: assignment.subject_id,
      sectionId: assignment.section_id,
      subjectCode: assignment.subject_code ?? '-',
      subjectName: assignment.subject_name ?? '-',
      periodsHeld: stats.periodsHeld,
      periodsAttended: stats.periodsAttended,
      attendancePct,
    }
  })
}

export type AssignedClassCard = {
  sectionId: string
  sectionName: string
  yearOfStudy: number
  branchCode: string
  branchName: string
  subjectId: string
  subjectCode: string
  subjectName: string
  isLab: boolean
  roomNo: string | null
  classesTakenCount: number
  todayScheduledPeriod: number | null
}

export async function getFacultyAssignedClassCards(): Promise<AssignedClassCard[]> {
  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()

  // 1. Fetch timetable entries for this faculty
  let query = supabase
    .from('timetable_entries')
    .select(`
      section_id,
      subject_id,
      subject_code,
      subject_name,
      room_no,
      is_lab,
      day_of_week,
      period_number,
      sections(id, section_name, year_of_study, branches(code, name))
    `)
    .not('subject_id', 'is', null)

  if (user.role === 'faculty') {
    query = query.eq('default_faculty_id', user.id)
  }

  const { data: ttData, error: ttError } = await query
  if (ttError) throw ttError

  if (!ttData || ttData.length === 0) {
    return []
  }

  const todayDay = getISTWeekday()

  // 2. Map distinct section + subject
  const cardMap = new Map<string, AssignedClassCard>()

  for (const row of ttData) {
    if (!row.subject_id || !row.section_id) continue
    const key = `${row.section_id}:${row.subject_id}`

    const sec = row.sections as unknown as {
      id: string
      section_name: string
      year_of_study: number
      branches: { code: string; name: string } | null
    } | null

    const branchCode = sec?.branches?.code ?? 'ENGG'
    const branchName = sec?.branches?.name ?? 'Engineering'
    const sectionName = sec?.section_name ?? 'A'
    const yearOfStudy = sec?.year_of_study ?? 1

    let existing = cardMap.get(key)
    if (!existing) {
      existing = {
        sectionId: row.section_id,
        sectionName: `${branchCode} Yr ${yearOfStudy} - Sec ${sectionName}`,
        yearOfStudy,
        branchCode,
        branchName,
        subjectId: row.subject_id,
        subjectCode: row.subject_code ?? 'SUB',
        subjectName: row.subject_name ?? 'Subject',
        isLab: row.is_lab ?? false,
        roomNo: row.room_no ?? 'APJ-205',
        classesTakenCount: 0,
        todayScheduledPeriod: null,
      }
      cardMap.set(key, existing)
    }

    if (row.day_of_week === todayDay && existing.todayScheduledPeriod === null) {
      existing.todayScheduledPeriod = row.period_number
    }
  }

  const cards = Array.from(cardMap.values())
  if (cards.length === 0) return []

  // 3. Count classes taken (completed or with records) for each section + subject
  const sectionIds = [...new Set(cards.map((c) => c.sectionId))]
  const subjectIds = [...new Set(cards.map((c) => c.subjectId))]

  const { data: completedSessions, error: countError } = await supabase
    .from('sessions')
    .select('section_id, subject_id, status, marked_at')
    .in('section_id', sectionIds)
    .in('subject_id', subjectIds)
    .or('status.eq.completed,marked_at.not.is.null')

  if (!countError && completedSessions) {
    const countMap = new Map<string, number>()
    for (const s of completedSessions) {
      if (!s.section_id || !s.subject_id) continue
      const k = `${s.section_id}:${s.subject_id}`
      countMap.set(k, (countMap.get(k) ?? 0) + 1)
    }

    for (const card of cards) {
      const k = `${card.sectionId}:${card.subjectId}`
      card.classesTakenCount = countMap.get(k) ?? 0
    }
  }

  return cards
}

export async function submitFacultyAssignmentRequest(args: {
  yearOfStudy: number
  branchCode: string
  sectionName: string
  subjectId?: string
  subjectName: string
  subjectCode: string
  notes?: string
}) {
  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw new Error('Only faculty may request class assignments')
  }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('faculty_assignment_requests')
    .insert({
      faculty_id: user.id,
      year_of_study: args.yearOfStudy,
      branch_code: args.branchCode.toUpperCase().trim(),
      section_name: args.sectionName.toUpperCase().trim(),
      subject_id: args.subjectId || null,
      subject_name: args.subjectName,
      subject_code: args.subjectCode.toUpperCase().trim(),
      notes: args.notes || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getFacultyAssignmentRequests() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  let query = supabase
    .from('faculty_assignment_requests')
    .select(`
      id,
      faculty_id,
      year_of_study,
      branch_code,
      section_name,
      subject_id,
      subject_name,
      subject_code,
      notes,
      status,
      created_at,
      profiles:faculty_id(full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (user.role === 'faculty') {
    query = query.eq('faculty_id', user.id)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function reviewFacultyAssignmentRequest(args: {
  requestId: string
  action: 'approved' | 'rejected'
}) {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    throw new Error('Only administrators can approve class assignment requests')
  }
  const supabase = await createClient()

  // 1. Fetch the request
  const { data: request, error } = await supabase
    .from('faculty_assignment_requests')
    .select('*')
    .eq('id', args.requestId)
    .single()

  if (error || !request) throw new Error('Assignment request not found')

  // 2. Update status
  await supabase
    .from('faculty_assignment_requests')
    .update({
      status: args.action,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', args.requestId)

  if (args.action === 'approved') {
    // Find matching branch and section
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('code', request.branch_code)
      .maybeSingle()

    let sectionQuery = supabase
      .from('sections')
      .select('id')
      .eq('year_of_study', request.year_of_study)
      .ilike('section_name', request.section_name)

    if (branch?.id) {
      sectionQuery = sectionQuery.eq('branch_id', branch.id)
    }
    const { data: section } = await sectionQuery.maybeSingle()

    let resolvedSubjectId = request.subject_id

    // If faculty requested a brand new course subject not yet in catalog
    if (!resolvedSubjectId && request.subject_code && request.subject_name) {
      const { data: existingSub } = await supabase
        .from('subjects')
        .select('id')
        .eq('code', request.subject_code)
        .maybeSingle()

      if (existingSub) {
        resolvedSubjectId = existingSub.id
      } else {
        const isLab = (request.notes || '').toLowerCase().includes('lab')
        const { data: createdSub, error: createError } = await supabase
          .from('subjects')
          .insert({
            code: request.subject_code,
            name: request.subject_name,
            branch_id: branch?.id || null,
            subject_type: isLab ? 'lab' : 'theory',
          })
          .select('id')
          .single()

        if (!createError && createdSub) {
          resolvedSubjectId = createdSub.id
        }
      }

      // Update the request with the resolved subject ID
      if (resolvedSubjectId) {
        await supabase
          .from('faculty_assignment_requests')
          .update({ subject_id: resolvedSubjectId })
          .eq('id', args.requestId)
      }
    }

    if (section && resolvedSubjectId) {
      await supabase.from('section_subjects').upsert(
        { section_id: section.id, subject_id: resolvedSubjectId },
        { onConflict: 'section_id,subject_id' }
      )
      await supabase
        .from('timetable_entries')
        .update({ default_faculty_id: request.faculty_id })
        .eq('section_id', section.id)
        .eq('subject_id', resolvedSubjectId)
    }
  }

  return { success: true }
}

