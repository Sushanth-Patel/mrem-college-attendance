import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

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

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await createClient()

    // 1. Get student's assigned section
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, roll_no, section_id, sections(id, section_name, year_of_study, semester, academic_year, branches(name, code))')
      .eq('id', user.id)
      .maybeSingle()

    if (studentError) throw studentError

    const section = student?.sections as any
    const sectionId = student?.section_id || section?.id

    if (!sectionId) {
      return NextResponse.json({
        success: true,
        hasTimetable: false,
        message: 'No section assigned to your profile.',
        entries: [],
      })
    }

    // 2. Fetch timetable entries for this section
    const { data: entries, error: entriesError } = await supabase
      .from('timetable_entries')
      .select('*')
      .eq('section_id', sectionId)
      .order('period_number', { ascending: true })

    if (entriesError) throw entriesError

    const normalizedEntries = (entries || []).map((e) => ({
      ...e,
      day_of_week: fromDbDay(e.day_of_week),
    }))

    // 3. Period Slots Info
    const periodSlots = [
      { period: 1, time: '09:30 - 10:20', label: 'Period 1' },
      { period: 2, time: '10:20 - 11:10', label: 'Period 2' },
      { period: 3, time: '11:20 - 12:10', label: 'Period 3' },
      { period: 4, time: '12:10 - 01:00', label: 'Period 4' },
      { period: 5, time: '01:40 - 02:30', label: 'Period 5' },
      { period: 6, time: '02:30 - 03:20', label: 'Period 6' },
      { period: 7, time: '03:20 - 04:10', label: 'Period 7' },
    ]

    return NextResponse.json({
      success: true,
      hasTimetable: normalizedEntries.length > 0,
      section: {
        id: sectionId,
        name: section?.section_name || 'A',
        year: section?.year_of_study || 4,
        semester: section?.semester || 'even',
        academicYear: section?.academic_year || '2025-2026',
        branchCode: section?.branches?.code || 'CSE',
        branchName: section?.branches?.name || 'Computer Science and Engineering',
      },
      periodSlots,
      entries: normalizedEntries,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch student timetable' },
      { status: 500 }
    )
  }
}
