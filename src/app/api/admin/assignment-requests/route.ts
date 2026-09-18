import { NextResponse, type NextRequest } from 'next/server'
import { reviewFacultyAssignmentRequest } from '@/lib/faculty/dashboard'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, action } = body

    if (!requestId || !action || (action !== 'approved' && action !== 'rejected')) {
      return NextResponse.json(
        { error: 'Valid requestId and action (approved or rejected) are required.' },
        { status: 400 }
      )
    }

    const result = await reviewFacultyAssignmentRequest({
      requestId,
      action,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to review assignment request' },
      { status: 500 }
    )
  }
}
