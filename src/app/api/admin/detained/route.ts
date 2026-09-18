import { NextResponse, type NextRequest } from 'next/server'
import { getDetainedStudentsList, updateStudentDetentionStatus } from '@/lib/admin/detained'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || undefined
    const yearParam = searchParams.get('year')
    const yearOfStudy = yearParam ? parseInt(yearParam, 10) : undefined
    const sectionId = searchParams.get('sectionId') || undefined
    const statusParam = searchParams.get('status') as 'detained' | 'active' | 'all' | null
    const status = statusParam || 'detained'

    const list = await getDetainedStudentsList({
      branchId,
      yearOfStudy,
      sectionId,
      status,
    })

    return NextResponse.json({ success: true, students: list })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch detained students' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, newStatus, reason } = body

    if (!studentId || !['active', 'detained'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid student ID or status' }, { status: 400 })
    }

    const result = await updateStudentDetentionStatus({
      studentId,
      newStatus,
      reason,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update student detention status' },
      { status: 500 }
    )
  }
}
