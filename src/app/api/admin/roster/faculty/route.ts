import { NextResponse, type NextRequest } from 'next/server'
import { uploadFacultyRoster } from '@/lib/admin/roster'

export async function POST(request: NextRequest) {
  try {
    const { csvText } = await request.json()
    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'CSV text is required' }, { status: 400 })
    }

    await uploadFacultyRoster(csvText)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process faculty roster' },
      { status: 500 }
    )
  }
}
