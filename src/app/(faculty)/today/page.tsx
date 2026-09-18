import { getFacultyTodaySchedule } from '@/lib/faculty/dashboard'
import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { IST_TIMEZONE } from '@/lib/timezone'
import TodayScheduleView, { type SessionCardSlot } from './TodayScheduleView'

export const dynamic = 'force-dynamic'

export default async function FacultyTodaySchedulePage() {
  const schedule = await getFacultyTodaySchedule().catch((err) => {
    console.error('Failed to load faculty schedule', err)
    return []
  })
  const supabase = await createClient()
  const todayDate = formatInTimeZone(new Date(), IST_TIMEZONE, 'yyyy-MM-dd')
  const formattedToday = formatInTimeZone(new Date(), IST_TIMEZONE, 'EEEE, dd MMMM yyyy')

  type SlotOutcome = {
    slot: (typeof schedule)[number]
    sessionId: string | null
    status: string | null
    error: string | null
    nonAcademic: boolean
  }

  // Non-academic rows (Library/Sports) carry no subject and generate no sessions (PRD §5.2)
  const academicSlots = schedule.filter((slot) => slot.subject_id)

  // One fetch + one upsert for the whole day, instead of two queries per slot.
  const findOrCreateSessions = async (): Promise<Map<string, { id: string; status: string }>> => {
    if (academicSlots.length === 0) return new Map()

    const { data: existing, error: findError } = await supabase
      .from('sessions')
      .select('id, status, section_id, subject_id, period_number')
      .eq('session_date', todayDate)
      .in(
        'section_id',
        [...new Set(academicSlots.map((slot) => slot.section_id))]
      )
      .in(
        'subject_id',
        [...new Set(academicSlots.map((slot) => slot.subject_id))]
      )
    if (findError) throw findError

    const key = (sectionId: string, subjectId: string, period: number) =>
      `${sectionId}:${subjectId}:${period}`
    const existingByKey = new Map(
      (existing ?? []).map((session) => [
        key(session.section_id, session.subject_id, session.period_number),
        { id: session.id, status: session.status },
      ])
    )

    const missing = academicSlots.filter(
      (slot) => !existingByKey.has(key(slot.section_id, slot.subject_id, slot.period_number))
    )
    if (missing.length > 0) {
      const { error: insertError } = await supabase.from('sessions').upsert(
        missing.map((slot) => ({
          section_id: slot.section_id,
          subject_id: slot.subject_id,
          period_number: slot.period_number,
          actual_faculty_id: slot.default_faculty_id,
          session_date: todayDate,
          status: 'scheduled',
        })),
        // Matches the live UNIQUE (section_id, session_date, period_number) constraint.
        // (subject_id is a function of section+period on the timetable, and a
        // 4-column tuple with subject_id matches no constraint — ON CONFLICT would
        // fail with 42P10.)
        { onConflict: 'section_id,session_date,period_number', ignoreDuplicates: true }
      )
      if (insertError) throw insertError

      // Re-read once for the rows we may have raced on
      const { data: created, error: reReadError } = await supabase
        .from('sessions')
        .select('id, status, section_id, subject_id, period_number')
        .eq('session_date', todayDate)
        .in(
          'section_id',
          [...new Set(missing.map((slot) => slot.section_id))]
        )
        .in(
          'subject_id',
          [...new Set(missing.map((slot) => slot.subject_id))]
        )
      if (reReadError) throw reReadError
      for (const session of created ?? []) {
        existingByKey.set(
          key(session.section_id, session.subject_id, session.period_number),
          { id: session.id, status: session.status }
        )
      }
    }

    return existingByKey
  }

  let sessionsByKey = new Map<string, { id: string; status: string }>()
  let sessionLoadError: string | null = null
  try {
    sessionsByKey = await findOrCreateSessions()
  } catch (err) {
    console.error('Session find-or-create failed for today', err)
    sessionLoadError =
      'Sessions could not be opened for marking today — please retry in a moment.'
  }

  const sessionData: SlotOutcome[] = schedule.map((slot) => {
    if (!slot.subject_id) {
      return { slot, sessionId: null, status: null, error: null, nonAcademic: true }
    }
    if (sessionLoadError) {
      return { slot, sessionId: null, status: null, error: sessionLoadError, nonAcademic: false }
    }
    const session = sessionsByKey.get(
      `${slot.section_id}:${slot.subject_id}:${slot.period_number}`
    )
    return {
      slot,
      sessionId: session?.id ?? null,
      status: session?.status ?? null,
      error: session ? null : 'Session could not be opened for marking today.',
      nonAcademic: false,
    }
  })

  // Shape rows for the antigravity presentation layer.
  const sessions: SessionCardSlot[] = sessionData.map(({ slot, sessionId, status, error, nonAcademic }) => {
    const periodSlot = slot.period_slots as unknown as { period_number: number; start_time: string; end_time: string; label: string | null } | null
    const secSub = slot.section_subjects as unknown as {
      id: string
      subjects?: { code: string; name: string; subject_type: string }
    } | null

    const state: SessionCardSlot['state'] = nonAcademic
      ? 'non-academic'
      : error
        ? 'error'
        : sessionId
          ? 'markable'
          : 'inactive'

    return {
      id: slot.id,
      periodNumber: periodSlot?.period_number ?? '1',
      subjectCode: secSub?.subjects?.code ?? 'SUB',
      subjectName: secSub?.subjects?.name ?? 'Assigned Course',
      startTime: periodSlot?.start_time?.slice(0, 5) ?? '—',
      endTime: periodSlot?.end_time?.slice(0, 5) ?? '—',
      room: slot.room ?? null,
      isLab: secSub?.subjects?.subject_type === 'lab',
      status: status ?? null,
      sessionId: sessionId ?? null,
      href: sessionId ? `/marking/${sessionId}` : null,
      state,
      message: error ?? null,
    }
  })

  return <TodayScheduleView formattedToday={formattedToday} sessions={sessions} />
}
