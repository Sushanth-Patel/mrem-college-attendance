import { createClient } from '@/lib/supabase/server'
import { requireFaculty } from '@/lib/auth/guards'

type LookupEntry = {
  id: string
  section_id: string
  subject_id: string | null
  period_number: number
  is_lab: boolean
}

/**
 * Find or create a session for a given section + subject + date + period,
 * used by the manual lookup flow (PRD §5.3 path 2).
 *
 * Runs against the live timetable_entries shape: section_id, subject_id,
 * day_of_week, period_number. Any faculty may open any session — swap/cover
 * marking is intentional (PRD §5.3), so lookup is not restricted to the
 * timetable's default faculty.
 */
export async function findOrCreateSession(args: {
  sectionId: string
  subjectId: string
  date: string // ISO date string
  periodNumber: number
}): Promise<string> {
  await requireFaculty()
  const supabase = await createClient()

  // The timetable entry identifies the (section, day, period) slot; the live
  // schema's UNIQUE(section_id, session_date, period_number) on sessions keys
  // sessions by slot, not by subject.
  const { data: entry, error: entryError } = await supabase
    .from('timetable_entries')
    .select('id, section_id, subject_id, period_number')
    .eq('section_id', args.sectionId)
    .eq('day_of_week', weekdayFor(args.date))
    .eq('period_number', args.periodNumber)
    .maybeSingle()

  if (entryError) throw entryError
  if (!entry) {
    throw new Error('No timetable entry found for this section, day and period')
  }
  if (entry.subject_id !== args.subjectId) {
    throw new Error('The selected subject does not match the timetable for this period')
  }

  // Conflict-safe find-or-create: two staff opening the same slot race on the
  // UNIQUE(section_id, session_date, period_number) constraint; upsert with
  // ignoreDuplicates + re-read resolves deterministically.
  const { error: upsertError } = await supabase.from('sessions').upsert(
    {
      section_id: entry.section_id,
      subject_id: entry.subject_id,
      session_date: args.date,
      period_number: entry.period_number,
      actual_faculty_id: null,
      is_admin_marked: false,
      marked_at: null,
      status: 'scheduled',
    },
    { onConflict: 'section_id,session_date,period_number', ignoreDuplicates: true }
  )
  if (upsertError) throw upsertError

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('section_id', entry.section_id)
    .eq('session_date', args.date)
    .eq('period_number', entry.period_number)
    .single()
  if (sessionError || !session) {
    throw sessionError ?? new Error('Session could not be resolved after find-or-create')
  }
  return session.id
}

type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

function weekdayFor(date: string): Weekday {
  // Parse as IST noon so the weekday is computed in the institution's timezone
  // regardless of the server's UTC offset.
  const day = new Date(`${date}T12:00:00+05:30`).getUTCDay()
  const map: Weekday[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'monday', // Sunday has no teaching timetable (PRD §5)
  ]
  return map[day]
}

/**
 * Get available sections and subjects for the manual lookup dropdowns.
 */
export async function getFacultyLookupOptions() {
  await requireFaculty()
  const supabase = await createClient()

  const { data: activeSections, error: sectionsError } = await supabase
    .from('sections')
    .select('id, section_name, year_of_study, semester, academic_year, branches(name, code)')
    .eq('is_active', true)
  if (sectionsError) throw sectionsError

  const sectionIds = (activeSections ?? []).map((s) => s.id)
  if (sectionIds.length === 0) {
    return { allSections: [], allSectionSubjects: [] }
  }

  const { data: sectionSubjects, error: ssError } = await supabase
    .from('timetable_entries')
    .select('section_id, subject_id, subject_code, subject_name, is_lab')
    .in('section_id', sectionIds)
    .not('subject_id', 'is', null)
  if (ssError) throw ssError

  // Distinct (section, subject) pairs as taught on the timetable — this is
  // what faculty can actually mark, independent of default-faculty rows.
  const pairs = new Map(
    (sectionSubjects ?? [])
      .filter((e) => e.subject_id)
      .map((e) => [`${e.section_id}:${e.subject_id}`, e])
  )

  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects')
    .select('id, code, name, subject_type')
    .in(
      'id',
      [...pairs.values()].map((e) => e.subject_id as string)
    )
  if (subjectsError) throw subjectsError
  const subjectsById = new Map((subjects ?? []).map((s) => [s.id, s]))

  const allSectionSubjects = [...pairs.values()].map((e) => {
    const subject = subjectsById.get(e.subject_id as string)
    return {
      id: `${e.section_id}:${e.subject_id}`,
      section_id: e.section_id,
      subject_id: e.subject_id,
      subjects: {
        code: subject?.code ?? e.subject_code ?? 'SUB',
        name: subject?.name ?? e.subject_name ?? 'Assigned Course',
        subject_type: subject?.subject_type ?? (e.is_lab ? 'lab' : 'theory'),
      },
    }
  })

  return {
    allSections: activeSections ?? [],
    allSectionSubjects,
  }
}

/**
 * Faculty marks a session as cancelled (PRD §5.4) — cancelled sessions drop
 * out of every student's denominator automatically at query time.
 */
export async function facultyMarkSessionStatus(
  sessionId: string,
  status: 'cancelled'
): Promise<void> {
  const faculty = await requireFaculty()
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, marked_at')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) {
    throw sessionError ?? new Error('Session not found')
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status, actual_faculty_id: faculty.id, is_admin_marked: false })
    .eq('id', sessionId)
  if (updateError) throw updateError

  // Direct audit insert: session-level actions target the sessions row, not an
  // attendance record or student, and use the dedicated action enum value.
  const { error: auditError } = await supabase.from('audit_log').insert({
    performed_by: faculty.id,
    action: 'session_cancelled',
    target_table: 'sessions',
    target_id: sessionId,
    old_value: { status: session.status },
    new_value: { status, reason: 'Session cancelled by faculty' },
  })
  if (auditError) throw auditError
}
