import { NextResponse, type NextRequest } from 'next/server'
import {
  submitFacultyAssignmentRequest,
  getFacultyAssignmentRequests,
} from '@/lib/faculty/dashboard'

export async function GET() {
  try {
    const requests = await getFacultyAssignmentRequests()
    return NextResponse.json({ requests })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch assignment requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { yearOfStudy, branchCode, sectionName, subjectId, subjectName, subjectCode, notes } = body

    if (!yearOfStudy || !branchCode || !sectionName || !subjectName || !subjectCode) {
      return NextResponse.json(
        { error: 'Year, Branch, Section, and Subject details are required.' },
        { status: 400 }
      )
    }

    const newRequest = await submitFacultyAssignmentRequest({
      yearOfStudy: Number(yearOfStudy),
      branchCode: String(branchCode),
      sectionName: String(sectionName),
      subjectId: subjectId || undefined,
      subjectName: String(subjectName),
      subjectCode: String(subjectCode),
      notes: notes ? String(notes) : undefined,
    })

    return NextResponse.json({ success: true, request: newRequest })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit assignment request' },
      { status: 500 }
    )
  }
}
