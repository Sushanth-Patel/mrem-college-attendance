import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

function toDbDay(d: string): string {
  const lower = (d || '').toLowerCase()
  if (lower.startsWith('mon')) return 'monday'
  if (lower.startsWith('tue')) return 'tuesday'
  if (lower.startsWith('wed')) return 'wednesday'
  if (lower.startsWith('thu')) return 'thursday'
  if (lower.startsWith('fri')) return 'friday'
  if (lower.startsWith('sat')) return 'saturday'
  return lower
}

function fromDbDay(d: string): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const lower = (d || '').toLowerCase()
  if (lower.startsWith('mon')) return 'mon'
  if (lower.startsWith('tue')) return 'tue'
  if (lower.startsWith('wed')) return 'wed'
  if (lower.startsWith('thu')) return 'thu'
  if (lower.startsWith('fri')) return 'fri'
  if (lower.startsWith('sat')) return 'sat'
  return 'mon'
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const sectionId = request.nextUrl.searchParams.get('sectionId')

    if (sectionId) {
      // Fetch specific section timetable
      const { data: entries, error } = await supabase
        .from('timetable_entries')
        .select('*')
        .eq('section_id', sectionId)

      if (error) throw error

      const normalized = (entries || []).map((e) => ({
        ...e,
        day_of_week: fromDbDay(e.day_of_week),
      }))

      return NextResponse.json({ success: true, entries: normalized })
    }

    // Fetch all sections with their timetable entry counts
    const { data: sections, error: secError } = await supabase
      .from('sections')
      .select('id, section_name, year_of_study, semester, academic_year, is_active, branches(id, name, code)')
      .eq('is_active', true)
      .order('year_of_study', { ascending: false })

    if (secError) throw secError

    const { data: allEntries } = await supabase
      .from('timetable_entries')
      .select('section_id, day_of_week, period_number, subject_name, subject_code, faculty_name, room_no')

    const countBySection = new Map<string, number>()
    const entriesBySection = new Map<string, any[]>()
    for (const e of allEntries || []) {
      countBySection.set(e.section_id, (countBySection.get(e.section_id) || 0) + 1)
      const curr = entriesBySection.get(e.section_id) || []
      curr.push({
        ...e,
        day_of_week: fromDbDay(e.day_of_week),
      })
      entriesBySection.set(e.section_id, curr)
    }

    const sectionsWithTimetable = (sections || []).map((s: any) => ({
      ...s,
      totalSlots: countBySection.get(s.id) || 0,
      hasTimetable: (countBySection.get(s.id) || 0) > 0,
      entries: entriesBySection.get(s.id) || [],
    }))

    return NextResponse.json({ success: true, timetables: sectionsWithTimetable })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch timetable' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const body = await request.json()
    const { sectionId, entries } = body

    if (!sectionId || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Section ID and entries array are required' }, { status: 400 })
    }

    // 1. Delete existing timetable entries for this section to avoid conflicts
    await supabase.from('timetable_entries').delete().eq('section_id', sectionId)

    // 2. Prepare entries to insert. Sessions require a subject_id, so try to
    // resolve each entry's display code/name against the subjects catalog
    // (best-effort: unmatched entries stay display-only and are skipped when
    // opening sessions for marking).
    const labels = entries
      .filter((e: any) => e.subject_name?.trim() || e.subject_code?.trim())
      .map((e: any) => ({
        code: e.subject_code?.trim() || '',
        name: e.subject_name?.trim() || '',
      }))
    const normalizeSubjectText = (value: string) =>
      value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const subjectIdByLabel = new Map<string, string>()
    if (labels.length > 0) {
      const { data: subjectCatalog, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, code, name')
      if (subjectsError) throw subjectsError
      for (const label of labels) {
        const normalizedLabel = normalizeSubjectText(label.code || label.name)
        if (!normalizedLabel || subjectIdByLabel.has(normalizedLabel)) continue
        const match =
          subjectCatalog?.find((s) => s.code.toUpperCase() === label.code.toUpperCase() && label.code) ??
          subjectCatalog?.find((s) => normalizeSubjectText(s.name) === normalizeSubjectText(label.name) && label.name) ??
          subjectCatalog?.find((s) => normalizeSubjectText(s.name).startsWith(normalizedLabel))
        if (match) subjectIdByLabel.set(normalizedLabel, match.id)
      }
    }
    const toInsert = entries
      .filter((e: any) => e.subject_name?.trim() || e.subject_code?.trim())
      .map((e: any) => {
        const normalizedLabel = normalizeSubjectText(e.subject_code?.trim() || e.subject_name?.trim() || '')
        return {
          section_id: sectionId,
          day_of_week: toDbDay(e.day_of_week),
          period_number: Number(e.period_number),
          subject_id: subjectIdByLabel.get(normalizedLabel) ?? null,
          subject_name: e.subject_name?.trim() || null,
          subject_code: e.subject_code?.trim() || null,
          faculty_name: e.faculty_name?.trim() || null,
          room_no: e.room_no?.trim() || null,
          is_lab: !!e.is_lab,
        }
      })

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('timetable_entries').insert(toInsert)
      if (insertError) throw insertError
    }

    return NextResponse.json({
      success: true,
      message: `Saved ${toInsert.length} timetable periods for section.`,
      count: toInsert.length,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save timetable' },
      { status: 500 }
    )
  }
}
