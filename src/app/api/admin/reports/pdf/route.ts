import { NextResponse, type NextRequest } from 'next/server'
import { generateAttendancePdf } from '@/lib/admin/reports'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId') || undefined

    const pdfBytes = await generateAttendancePdf(sectionId)

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Attendance_Report.pdf"',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF export failed' },
      { status: 500 }
    )
  }
}
