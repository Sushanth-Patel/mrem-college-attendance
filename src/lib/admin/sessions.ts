import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Session lifecycle states. 'holiday' and 'cancelled' both drop the session out
 * of every student's denominator (PRD §5.4); they are kept distinct so a report
 * can tell "college was closed" from "this class did not run".
 */
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'holiday'

export const NON_HELD_STATUSES: SessionStatus[] = ['cancelled', 'holiday']

async function logSessionStatusChange(args: {
  adminId: string
  sessionId: string
  oldStatus: string
  newStatus: SessionStatus
  reason: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('audit_log').insert({
    performed_by: args.adminId,
    action: 'session_cancelled',
    target_table: 'sessions',
    target_id: args.sessionId,
    old_value: { status: args.oldStatus },
    new_value: {
      status: args.newStatus,
      ...(args.reason ? { reason: args.reason } : {}),
    },
  })
  if (error) throw error
}

/**
 * Set a single session's status. Flipping a session to cancelled/holiday — or
 * back to scheduled — takes effect on every affected student's percentage
 * immediately, because the denominator is computed from sessions.status at
 * query time and no attendance record is ever deleted (PRD §5.4, §6.6).
 */
export async function setSessionStatus(
  sessionId: string,
  status: SessionStatus,
  reason?: string
) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .single()
  if (existingError || !existing) {
    throw existingError ?? new Error('Session not found')
  }
  if (existing.status === status) return { changed: 0 }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', sessionId)
  if (updateError) throw updateError

  await logSessionStatusChange({
    adminId: admin.id,
    sessionId,
    oldStatus: existing.status,
    newStatus: status,
    reason: reason ?? null,
  })

  return { changed: 1 }
}

/**
 * Bulk-set the status of every session a section has on a given date — this is
 * the retroactive holiday declaration from PRD §5.4. It works on days that were
 * already marked: the attendance records survive untouched and simply stop
 * counting, and are restored intact if the day is re-opened.
 *
 * Passing no sectionId applies the change college-wide for that date, which is
 * the common case for an unscheduled closure.
 */
export async function bulkSetSessionStatusByDate(args: {
  date: string
  status: SessionStatus
  sectionId?: string | null
  reason?: string
}) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  let selectQuery = supabase
    .from('sessions')
    .select('id, status')
    .eq('session_date', args.date)
  if (args.sectionId) selectQuery = selectQuery.eq('section_id', args.sectionId)

  const { data: affected, error: selectError } = await selectQuery
  if (selectError) throw selectError

  const changing = (affected ?? []).filter((session) => session.status !== args.status)
  if (changing.length === 0) return { changed: 0 }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status: args.status })
    .in(
      'id',
      changing.map((session) => session.id)
    )
  if (updateError) throw updateError

  // One audit row per session: the trail has to answer "what happened to THIS
  // session" for any single session, not just "a bulk action happened".
  for (const session of changing) {
    await logSessionStatusChange({
      adminId: admin.id,
      sessionId: session.id,
      oldStatus: session.status,
      newStatus: args.status,
      reason: args.reason ?? null,
    })
  }

  return { changed: changing.length }
}

/**
 * Sessions on a date (optionally one section), with the subject/section labels
 * the calendar UI needs to let Admin pick what to cancel.
 */
export async function listSessionsForDate(args: { date: string; sectionId?: string | null }) {
  await requireAdmin()
  const supabase = await createClient()

  let query = supabase
    .from('sessions')
    .select(
      'id, session_date, period_number, status, is_admin_marked, section_id, subject_id, sections(section_name, year_of_study, academic_year, branches(code)), subjects(code, name)'
    )
    .eq('session_date', args.date)
    .order('period_number')
  if (args.sectionId) query = query.eq('section_id', args.sectionId)

  const { data, error } = await query
  if (error) throw error

  const sessionIds = (data ?? []).map((session) => session.id)
  const markedCounts = new Map<string, number>()
  if (sessionIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select('session_id')
      .in('session_id', sessionIds)
    if (recordsError) throw recordsError
    for (const record of records ?? []) {
      markedCounts.set(record.session_id, (markedCounts.get(record.session_id) ?? 0) + 1)
    }
  }

  return (data ?? []).map((session) => {
    const section = session.sections as unknown as {
      section_name: string
      year_of_study: number
      academic_year: string
      branches: { code: string } | null
    } | null
    const subject = session.subjects as unknown as { code: string; name: string } | null
    return {
      id: session.id,
      periodNumber: session.period_number,
      status: session.status as SessionStatus,
      isAdminMarked: session.is_admin_marked,
      sectionId: session.section_id,
      sectionLabel: section
        ? `${section.branches?.code ?? '—'} Y${section.year_of_study} ${section.section_name} (${section.academic_year})`
        : '—',
      subjectCode: subject?.code ?? '—',
      subjectName: subject?.name ?? 'Non-academic period',
      markedCount: markedCounts.get(session.id) ?? 0,
    }
  })
}
