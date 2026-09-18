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
import { markingError, type MarkingError } from '@/lib/attendance/marking'

export type { MarkingError }

/**
 * Get all session IDs that belong to the same lab/multi-period block
 * (consecutive periods of the same subject on the same day for the same section).
 * PRD §6.8: each period is its own sessions row.
 */
export async function getLabBlockSessionIds(
  sessionId: string
): Promise<string[]> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, section_id, subject_id, session_date, period_number')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    throw sessionError ?? markingError('Session not found', 404)
  }

  // Non-academic slots carry no subject and never form a block (PRD §5.2)
  if (!session.subject_id || session.period_number == null) {
    return [sessionId]
  }

  // All sessions of the same subject for the same section on the same date,
  // ordered by period — a lab block is a consecutive run among these.
  const { data: sameDaySessions, error: blockError } = await supabase
    .from('sessions')
    .select('id, period_number')
    .eq('section_id', session.section_id)
    .eq('subject_id', session.subject_id)
    .eq('session_date', session.session_date)
    .order('period_number')

  if (blockError) throw blockError
  if (!sameDaySessions || sameDaySessions.length <= 1) return [sessionId]

  const periods = sameDaySessions
    .filter((s) => s.period_number != null)
    .map((s) => ({ id: s.id, period: s.period_number as number }))
    .sort((a, b) => a.period - b.period)

  // Walk out from the clicked period in both directions while periods stay consecutive
  const clickedPeriod = session.period_number
  const startIdx = periods.findIndex((p) => p.period === clickedPeriod)
  if (startIdx === -1) return [sessionId]

  let lo = startIdx
  let hi = startIdx
  while (lo > 0 && periods[lo - 1].period === periods[lo].period - 1) lo -= 1
  while (hi < periods.length - 1 && periods[hi + 1].period === periods[hi].period + 1) hi += 1

  return periods.slice(lo, hi + 1).map((p) => p.id)
}

type BlockSessionRow = {
  id: string
  session_date: string
  actual_faculty_id: string | null
  is_admin_marked: boolean
  marked_at: string | null
  status: string
}

async function resolveMarkerNameFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facultyId: string | null
): Promise<string | null> {
  if (!facultyId) return null
  const { data: profile } = await supabase
    .from('faculty')
    .select('profiles(full_name)')
    .eq('id', facultyId)
    .maybeSingle()
  return (profile?.profiles as unknown as { full_name: string } | null)?.full_name ?? null
}

/**
 * Mark attendance for a lab/multi-period block — a single tap writes the same
 * status to all period-records simultaneously (PRD §6.8), with the same
 * integrity guarantees as the single-period save: payload validation, roster
 * validation, cancelled-session refusal, edit window, overwrite conflict gate
 * (PRD §6.9) and race-safe claim, diff-only writes, and per-change audit rows.
 */
export async function upsertBlockAttendance(args: {
  sessionId: string // any session in the block; we find the rest
  records: MarkingInputRecord[]
  overwriteConfirmed: boolean
  reason?: string
}) {
  if (!validateMarkingPayload(args.records)) {
    throw markingError('Attendance records contain an invalid or duplicate student entry', 400)
  }

  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw markingError('Only faculty and admin may mark attendance', 403)
  }

  const supabase = await createClient()
  const blockSessionIds = await getLabBlockSessionIds(args.sessionId)

  const { data: blockSessions, error: blockSessionsError } = await supabase
    .from('sessions')
    .select('id, session_date, actual_faculty_id, is_admin_marked, marked_at, status')
    .in('id', blockSessionIds)
  if (blockSessionsError) throw blockSessionsError

  const sessions = (blockSessions ?? []) as BlockSessionRow[]

  // Cancelled/holiday periods in the block are skipped, not failed — a
  // faculty tapping "apply to block" on a day where one period was declared
  // a holiday should not lose the other two (PRD §5.2/§5.4: non-held periods
  // have no attendance).
  const markable = sessions.filter((s) => s.status !== 'cancelled' && s.status !== 'holiday')
  if (markable.length === 0) {
    throw markingError('Every period in this block is cancelled or a holiday — nothing to mark', 409)
  }
  if (user.role === 'faculty') {
    for (const s of markable) {
      if (!isWithinFacultyEditWindow(s.session_date)) {
        throw markingError('Attendance edit window closed for faculty', 403)
      }
    }
  }

  // Roster validation: every incoming student must be an active member of the
  // block's section (all block sessions share section_id).
  const sectionId = await (async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('section_id')
      .eq('id', args.sessionId)
      .single()
    if (error) throw error
    return data.section_id
  })()

  const incomingIds = args.records.map((r) => r.studentId)
  const { data: roster, error: rosterError } = await supabase
    .from('students')
    .select('id, account_status')
    .eq('section_id', sectionId)
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

  // Conflict gate per session (PRD §6.9): a block may legitimately carry marks
  // from different markers per period — surface ALL of them, not just the first.
  if (!args.overwriteConfirmed && user.role !== 'admin') {
    const conflicts: MarkingConflict[] = []
    for (const s of markable) {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, student_id, status')
        .eq('session_id', s.id)
        .limit(1)
      if (!existing || existing.length === 0) continue
      const previousMarkerName = s.is_admin_marked
        ? 'admin'
        : await resolveMarkerNameFor(supabase, s.actual_faculty_id)
      const conflict = detectMarkingConflict({
        existing: existing.map((r) => ({
          studentId: r.student_id,
          status: r.status as AttendanceStatus,
          markedByName: previousMarkerName,
        })),
        incoming: args.records,
        currentMarkerName: user.fullName,
        currentMarkerIsAdmin: false,
      })
      if (conflict) {
        // Pure helper doesn't know the clock or the admin flag — the block's
        // session-level attribution carries both.
        conflict.markedAt = s.marked_at ?? conflict.markedAt
        conflict.isAdmin = s.is_admin_marked
        conflicts.push(conflict)
      }
    }
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map((c) => c.markedByName))].join(', ')
      const when = conflicts.find((c) => c.markedAt)?.markedAt
      throw markingError(
        `Attendance already submitted by ${names}${when ? ` at ${formatIST(when, 'dd MMM yyyy, hh:mm a')} IST` : ''}. Confirm overwrite before saving.`,
        409,
        { markedByName: names, markedAt: when ?? null, isAdmin: conflicts.some((c) => c.isAdmin) }
      )
    }
  }

  // Race-safe claim on every markable session in the block, compared against
  // the values this request read (any change since → someone else saved → 409).
  for (const s of markable) {
    const claim = await supabase
      .from('sessions')
      .update({ marked_at: new Date().toISOString() })
      .eq('id', s.id)
      .or(s.marked_at ? `marked_at.is.null,marked_at.eq.${s.marked_at}` : 'marked_at.is.null')
      .select('id')
    if (claim.error || !claim.data || claim.data.length === 0) {
      throw markingError(
        'Another staff member just saved attendance for this block. Reload the sheet before making changes.',
        409,
        { markedByName: 'another staff member', markedAt: null, isAdmin: false }
      )
    }
  }

  // Attribute the block (PRD §5.3): a covering faculty save flips
  // actual_faculty_id on every markable session; admin marks set the flag.
  // Every markable period also moves to 'completed' — the block has been held.
  if (user.role === 'faculty') {
    await supabase
      .from('sessions')
      .update({ actual_faculty_id: user.id, is_admin_marked: false, status: 'completed' })
      .in('id', markable.map((s) => s.id))
  } else {
    await supabase
      .from('sessions')
      .update({ is_admin_marked: true, status: 'completed' })
      .in('id', markable.map((s) => s.id))
  }

  let changed = 0
  for (const s of markable) {
    const { data: existingRecords, error: existingError } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('session_id', s.id)
    if (existingError) throw existingError

    const diff = computeRecordDiff({
      existing: (existingRecords ?? []).map((r) => ({
        studentId: r.student_id,
        status: r.status as AttendanceStatus,
        markedByName: null,
      })),
      incoming: args.records,
    })
    if (diff.length === 0) continue
    changed += diff.length

    const { error: upsertError } = await supabase.from('attendance_records').upsert(
      diff.map((record) => ({
        session_id: s.id,
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
          .eq('session_id', s.id)
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
  }

  return { changed, sessions: markable.length }
}
