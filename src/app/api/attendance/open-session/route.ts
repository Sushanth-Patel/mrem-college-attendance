import { NextResponse, type NextRequest } from 'next/server'
import { openOrCreateClassSession } from '@/lib/attendance/take-attendance'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sectionId, subjectId, sessionDate, periodNumber } = body

    if (!sectionId || !subjectId || !sessionDate || !periodNumber) {
      return NextResponse.json(
        { error: 'Section, Subject, Session Date, and Period Number are required.' },
        { status: 400 }
      )
    }

    const result = await openOrCreateClassSession({
      sectionId,
      subjectId,
      sessionDate,
      periodNumber: parseInt(periodNumber, 10),
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to open class session' },
      { status: 500 }
    )
  }
}
