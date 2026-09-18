import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { facultyId, sectionId, subjectId } = body

    if (!facultyId || !sectionId || !subjectId) {
      return NextResponse.json(
        { error: 'Faculty, Section, and Subject are all required.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. Upsert into section_subjects
    await supabase.from('section_subjects').upsert(
      { section_id: sectionId, subject_id: subjectId },
      { onConflict: 'section_id,subject_id' }
    )

    // 2. Update timetable entries where section and subject match
    await supabase
      .from('timetable_entries')
      .update({ default_faculty_id: facultyId })
      .eq('section_id', sectionId)
      .eq('subject_id', subjectId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to allocate subject' },
      { status: 500 }
    )
  }
}
