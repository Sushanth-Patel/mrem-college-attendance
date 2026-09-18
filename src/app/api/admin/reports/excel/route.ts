import { NextResponse, type NextRequest } from 'next/server'
import { generateAttendanceExcel } from '@/lib/admin/reports'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId') || undefined

    const buffer = await generateAttendanceExcel(sectionId)

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Attendance_Report.xlsx"',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Excel export failed' },
      { status: 500 }
    )
  }
}
