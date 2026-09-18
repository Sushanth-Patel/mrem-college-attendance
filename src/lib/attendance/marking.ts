import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isWithinFacultyEditWindow, formatIST } from '@/lib/timezone'
import { logAudit } from '@/lib/audit-log'
import type { AttendanceStatus, MarkingInputRecord } from '@/lib/attendance/types'
import {
  computeRecordDiff,
  detectMarkingConflict,
  validateMarkingPayload,
  type MarkingConflict,
} from '@/lib/attendance/markSheet'

export type MarkingError = Error & { statusCode?: number; conflict?: MarkingConflict }

export function markingError(message: string, statusCode?: number, conflict?: MarkingConflict): MarkingError {
  const err = new Error(message) as MarkingError
  if (statusCode) err.statusCode = statusCode
  if (conflict) err.conflict = conflict
  return err
}

function defaultStatusForFlag(flag: 'regular' | 'irregular') {
  return flag === 'irregular' ? 'absent' : 'present'
}

type SessionRow = {
  id: string
  session_date: string
  section_id: string
  subject_id: string | null
  actual_faculty_id: string | null
  is_admin_marked: boolean
  marked_at: string | null
  status: string
}

/**
 * Load a session and, when attendance already exists, resolve WHO marked it
 * for the PRD §6.9 overwrite banner. Attribution lives on the session row:
 * actual_faculty_id → profile name (or "an Administrator" when is_admin_marked
 * is set and the faculty link is absent), plus sessions.marked_at. Per-record
 * change history is reconstructable from the append-only audit_log.
 */
async function loadSessionWithAttribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<SessionRow> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select(
      'id, session_date, section_id, subject_id, actual_faculty_id, is_admin_marked, marked_at, status'
    )
    .eq('id', sessionId)
    .single<SessionRow>()

  if (error || !session) {
    throw markingError('Session not found', 404)
  }
  return session
}

async function resolveMarkerName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: SessionRow
): Promise<string | null> {
  if (!session.actual_faculty_id) return null
  const { data: profile } = await supabase
    .from('faculty')
    .select('profiles(full_name)')
    .eq('id', session.actual_faculty_id)
    .maybeSingle()
  const fullName = (profile?.profiles as unknown as { full_name: string } | null)?.full_name
  return fullName ?? null
}

export async function canFacultyEditSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facultyUserId: string,
  session: { id: string; subject_id: string | null; actual_faculty_id: string | null }
): Promise<boolean> {
  // 1. If faculty was the actual marker who conducted this session
  if (session.actual_faculty_id === facultyUserId) {
    return true
  }

  // 2. If faculty is assigned to this subject in timetable_entries
  if (session.subject_id) {
    const { data } = await supabase
      .from('timetable_entries')
      .select('id')
      .eq('default_faculty_id', facultyUserId)
      .eq('subject_id', session.subject_id)
      .limit(1)
    if (data && data.length > 0) {
      return true
    }
  }

  return false
}

export async function getSessionMarkingSheet(sessionId: string) {
  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw markingError('Only faculty and admin may open a marking sheet', 403)
  }

  const supabase = await createClient()
  const session = await loadSessionWithAttribution(supabase, sessionId)

  // Faculty can correct attendance anytime for their respective subjects
  if (user.role === 'faculty' && !isWithinFacultyEditWindow(session.session_date)) {
    throw markingError('Attendance edit window closed for faculty', 403)
  }

  // Enforce subject ownership: faculty can only view/edit attendance for their respective subjects
  if (user.role === 'faculty' && session.marked_at) {
    const isAuthorized = await canFacultyEditSession(supabase, user.id, session)
    if (!isAuthorized) {
      throw markingError('You are only authorized to view and edit attendance for your respective subjects', 403)
    }
  }

  if (session.status === 'cancelled' || session.status === 'holiday') {
    throw markingError(
      `This session is ${session.status} — attendance marking is disabled`,
      409
    )
  }

  const [{ data: students, error: studentsError }, { count: detainedCount }] = await Promise.all([
    supabase
      .from('students')
      .select('id, roll_no, account_status, attendance_flag, profiles(full_name)')
      .eq('section_id', session.section_id)
      .eq('account_status', 'active')
      .order('roll_no'),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('section_id', session.section_id)
      .eq('account_status', 'detained'),
  ])

  if (studentsError) {
    throw studentsError
  }

  const { data: records, error: recordsError } = await supabase
    .from('attendance_records')
    .select('id, student_id, status')
    .eq('session_id', sessionId)

  if (recordsError) {
    throw recordsError
  }

  // Overwrite banner data (PRD §6.9): who marked, and when.
  let overwriteWarning: {
    markerName: string
    markedAt: string | null
    isAdmin: boolean
  } | null = null
  if (records.length > 0) {
    if (session.is_admin_marked) {
      overwriteWarning = { markerName: 'an Administrator', markedAt: session.marked_at, isAdmin: true }
    } else if (session.actual_faculty_id) {
      const markerName = await resolveMarkerName(supabase, session)
      overwriteWarning = {
        markerName: markerName ?? 'another staff member',
        markedAt: session.marked_at,
        isAdmin: false,
      }
    } else {
      overwriteWarning = { markerName: 'another staff member', markedAt: session.marked_at, isAdmin: false }
    }
  }

  const recordByStudent = new Map(records.map((record) => [record.student_id, record]))
  return {
    sessionId: session.id,
    sessionDate: session.session_date,
    sessionStatus: session.status,
    detainedCount: detainedCount ?? 0,
    overwriteWarning: overwriteWarning
      ? {
          markerName: overwriteWarning.markerName,
          markedAt: overwriteWarning.markedAt
            ? formatIST(overwriteWarning.markedAt, 'dd MMM yyyy, hh:mm a') + ' IST'
            : null,
          isAdmin: overwriteWarning.isAdmin,
        }
      : null,
    students: students.map((student) => {
      const existingRecord = recordByStudent.get(student.id)
      return {
        id: student.id,
        rollNo: student.roll_no,
        fullName: (student.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
        accountStatus: student.account_status,
        attendanceFlag: student.attendance_flag,
        locked: student.account_status === 'detained',
        status:
          existingRecord?.status ??
          (student.account_status === 'active'
            ? (defaultStatusForFlag(student.attendance_flag) as AttendanceStatus)
            : null),
      }
    }),
  }
}

/**
 * Save attendance for one session. Diff-only writes: unchanged rows are never
 * re-written, so a second staff member saving after viewing someone else's
 * submission does not re-attribute untouched rows. A conflict with a previous
 * named marker throws a 409 carrying the marker details; the client shows the
 * confirm modal and re-submits with overwriteConfirmed = true.
 */
export async function upsertSessionAttendance(args: {
  sessionId: string
  records: MarkingInputRecord[]
  overwriteConfirmed: boolean
  reason?: string
  adminUnlocked?: boolean
}) {
  if (!validateMarkingPayload(args.records)) {
    throw markingError('Attendance records contain an invalid or duplicate student entry', 400)
  }

  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw markingError('Only faculty and admin may mark attendance', 403)
  }

  const supabase = await createClient()
  const session = await loadSessionWithAttribution(supabase, args.sessionId)

  if (session.status === 'cancelled' || session.status === 'holiday') {
    throw markingError(
      `This session is ${session.status} — attendance marking is disabled`,
      409
    )
  }
  if (user.role === 'faculty' && !isWithinFacultyEditWindow(session.session_date)) {
    throw markingError('Attendance edit window closed for faculty', 403)
  }

  // Enforce subject ownership: faculty can only edit attendance for their respective subjects
  if (user.role === 'faculty' && session.marked_at) {
    const isAuthorized = await canFacultyEditSession(supabase, user.id, session)
    if (!isAuthorized) {
      throw markingError('You are only authorized to edit attendance for your respective subjects', 403)
    }
  }

  // Student roster validation against the session's own section — the server
  // must never trust a client payload claiming students from another section
  // or non-active students (detained/transferred are not markable).
  const incomingIds = args.records.map((r) => r.studentId)
  const { data: roster, error: rosterError } = await supabase
    .from('students')
    .select('id, account_status')
    .eq('section_id', session.section_id)
    .in('id', incomingIds)

  if (rosterError) throw rosterError
  const rosterById = new Map((roster ?? []).map((s) => [s.id, s.account_status]))
  for (const record of args.records) {
    const status = rosterById.get(record.studentId)
    if (!status) {
      throw markingError(`Student ${record.studentId} does not belong to this session's section`, 400)
    }
    if (status !== 'active') {
      throw markingError(`Student ${record.studentId} is ${status} and cannot be marked`, 400)
    }
  }

  const { data: existingRecords, error: existingError } = await supabase
    .from('attendance_records')
    .select('id, student_id, status')
    .eq('session_id', args.sessionId)
  if (existingError) throw existingError

  // Conflict gate (PRD §6.9) — resolve previous marker and prevent accidental overwrites.
  // If the faculty is editing their own previously marked session, bypass self-conflict modal.
  const isOwnEdit = user.role === 'faculty' && session.actual_faculty_id === user.id
  if (!args.overwriteConfirmed && (existingRecords?.length ?? 0) > 0 && user.role !== 'admin' && !isOwnEdit) {
    const previousMarkerName = session.is_admin_marked
      ? 'admin'
      : await resolveMarkerName(supabase, session)
    const existingForConflict = (existingRecords ?? []).map((record) => ({
      studentId: record.student_id,
      status: record.status as AttendanceStatus,
      markedByName: previousMarkerName,
    }))
    const conflict: MarkingConflict | null = detectMarkingConflict({
      existing: existingForConflict,
      incoming: args.records,
      currentMarkerName: user.fullName,
      currentMarkerIsAdmin: false,
    })
    if (conflict) {
      // detectMarkingConflict is pure and doesn't know the clock — session-level
      // attribution means the previous marker's timestamp IS session.marked_at.
      conflict.markedAt = session.marked_at ?? conflict.markedAt
      const displayTime = conflict.markedAt
        ? formatIST(conflict.markedAt, 'dd MMM yyyy, hh:mm a') + ' IST'
        : null
      throw markingError(
        `Attendance already submitted by ${conflict.markedByName}${displayTime ? ` at ${displayTime}` : ''}. Confirm overwrite before saving.`,
        409,
        conflict
      )
    }
  }

  const existingForDiff = (existingRecords ?? []).map((record) => ({
    studentId: record.student_id,
    status: record.status as AttendanceStatus,
    markedByName: null,
  }))

  const diff = computeRecordDiff({
    existing: existingForDiff,
    incoming: args.records,
  })

  // Nothing actually changed — do not stamp the session or write audit rows.
  if (diff.length === 0) {
    return { changed: 0 }
  }

  // Race claim (PRD §6.9): stamping sessions.marked_at as a guarded compare-
  // and-set means two faculty submitting near-simultaneously cannot both
  // silently "win" — the second save only proceeds if no one else claimed the
  // session since the sheet was loaded. When the claim fails, the client is
  // sent a 409 with the other marker's identity and its local state is stale.
  const claim = await supabase
    .from('sessions')
    .update({ marked_at: new Date().toISOString() })
    .eq('id', args.sessionId)
    .or(
      session.marked_at
        ? `marked_at.is.null,marked_at.eq.${session.marked_at}`
        : 'marked_at.is.null'
    )
    .select('id')
  if (claim.error || !claim.data || claim.data.length === 0) {
    throw markingError(
      'Another staff member just saved attendance for this session. Reload the sheet before making changes.',
      409,
      { markedByName: 'another staff member', markedAt: null, isAdmin: false }
    )
  }

  // Attribute the session to the person actually conducting it (PRD §5.3):
  // a covering faculty save flips actual_faculty_id; an admin save leaves
  // faculty attribution alone but sets the admin flag. Either way the session
  // moves out of 'scheduled' — it has now demonstrably been held, which is
  // what lets the admin views separate marked sessions from pending ones.
  // Cancelled/holiday sessions never reach here (refused above).
  if (user.role === 'faculty') {
    await supabase
      .from('sessions')
      .update({ actual_faculty_id: user.id, is_admin_marked: false, status: 'completed' })
      .eq('id', args.sessionId)
  } else {
    await supabase
      .from('sessions')
      .update({ is_admin_marked: true, status: 'completed' })
      .eq('id', args.sessionId)
  }

  const { error: upsertError } = await supabase.from('attendance_records').upsert(
    diff.map((record) => ({
      session_id: args.sessionId,
      student_id: record.studentId,
      status: record.status,
    })),
    { onConflict: 'session_id,student_id' }
  )
  if (upsertError) throw upsertError

  await Promise.all(
    diff.map(async (record) => {
      const { data: savedRecord, error: savedRecordError } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', args.sessionId)
        .eq('student_id', record.studentId)
        .single()
      if (savedRecordError || !savedRecord) {
        throw savedRecordError ?? new Error('Saved attendance record could not be found')
      }
      await logAudit({
        attendanceRecordId: savedRecord.id,
        studentId: record.studentId,
        fieldChanged: 'status',
        oldValue: record.previous,
        newValue: record.status,
        reason: args.reason ?? null,
      })
    })
  )

  return { changed: diff.length }
}
