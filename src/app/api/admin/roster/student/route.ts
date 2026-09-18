import { NextResponse, type NextRequest } from 'next/server'
import { uploadStudentRoster, importStudentRows } from '@/lib/admin/roster'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { csvText, rows, targetSectionId } = body

    if (Array.isArray(rows) && rows.length > 0) {
      const result = await importStudentRows(rows, targetSectionId)
      return NextResponse.json({ success: true, count: result.count })
    }

    if (csvText && typeof csvText === 'string') {
      const result = await uploadStudentRoster(csvText, targetSectionId)
      return NextResponse.json({ success: true, count: result.count })
    }

    return NextResponse.json({ error: 'Valid CSV text or student rows array is required' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process student roster' },
      { status: 500 }
    )
  }
}

