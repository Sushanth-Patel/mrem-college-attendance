import { NextResponse, type NextRequest } from 'next/server'
import {
  createSection,
  createBulkSections,
  updateSection,
  deleteSection,
  setSectionActiveState,
} from '@/lib/admin/sections'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const section = await createSection({
        branch_id: body.branch_id,
        year_of_study: Number(body.year_of_study),
        semester: body.semester,
        academic_year: body.academic_year,
        section_name: body.section_name,
        term_start_date: body.term_start_date,
        is_active: true,
      })
      return NextResponse.json({ success: true, section })
    }

    if (action === 'create_bulk') {
      const sections = await createBulkSections({
        branch_id: body.branch_id,
        year_of_study: Number(body.year_of_study),
        semester: body.semester,
        academic_year: body.academic_year,
        term_start_date: body.term_start_date,
        count: Number(body.count) || 1,
      })
      return NextResponse.json({ success: true, sections })
    }

    if (action === 'update') {
      const section = await updateSection(body.id, {
        section_name: body.section_name,
        year_of_study: Number(body.year_of_study),
        semester: body.semester,
        academic_year: body.academic_year,
        term_start_date: body.term_start_date,
        is_active: body.is_active,
      })
      return NextResponse.json({ success: true, section })
    }

    if (action === 'delete') {
      await deleteSection(body.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_status') {
      const section = await setSectionActiveState(body.id, Boolean(body.is_active))
      return NextResponse.json({ success: true, section })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 500 }
    )
  }
}
