import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatAcademicTerm } from '@/lib/academic'

export async function POST(request: NextRequest) {
  try {
    const { role, identifier } = await request.json()

    if (!role || !identifier || typeof identifier !== 'string') {
      return NextResponse.json({ found: false, error: 'Invalid input' }, { status: 400 })
    }

    const normalizedId = identifier.trim()
    if (!normalizedId) {
      return NextResponse.json({ found: false })
    }

    const supabase = createAdminClient()

    if (role === 'student') {
      // 1. Check if roll number is already registered in active students
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id, profiles(email, full_name)')
        .ilike('roll_no', normalizedId)
        .maybeSingle()

      if (existingStudent) {
        const prof = existingStudent.profiles as unknown as { email: string; full_name: string } | null
        return NextResponse.json({
          found: true,
          alreadyRegistered: true,
          fullName: prof?.full_name || 'Registered Student',
          email: prof?.email || '',
        })
      }

      const { data, error } = await supabase
        .from('roster_students')
        .select('roll_no, full_name, email, father_name, college_name, section_id, sections(section_name, year_of_study, semester, academic_year, branches(name, code))')
        .ilike('roll_no', normalizedId)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ found: false })
      }

      const sec = data.sections as unknown as {
        section_name: string
        year_of_study: number
        semester: string
        academic_year: string
        branches: { name: string; code: string } | null
      } | null

      const branchName = sec?.branches?.name ?? sec?.branches?.code ?? 'CSE'
      const sectionDesc = sec ? `${branchName} • Year ${sec.year_of_study} (${formatAcademicTerm(sec.semester)}) Sec ${sec.section_name}` : 'CSE Section'

      return NextResponse.json({
        found: true,
        alreadyRegistered: false,
        fullName: data.full_name,
        email: data.email,
        fatherName: data.father_name || '',
        collegeName: data.college_name || '',
        branch: branchName,
        section: sectionDesc,
      })
    } else if (role === 'faculty') {
      // 1. Check if faculty employee_id is already registered
      const { data: existingFaculty } = await supabase
        .from('faculty')
        .select('id, profiles(email, full_name)')
        .ilike('employee_id', normalizedId)
        .maybeSingle()

      if (existingFaculty) {
        const prof = existingFaculty.profiles as unknown as { email: string; full_name: string } | null
        return NextResponse.json({
          found: true,
          alreadyRegistered: true,
          fullName: prof?.full_name || 'Registered Faculty',
          email: prof?.email || '',
        })
      }

      const { data, error } = await supabase
        .from('roster_faculty')
        .select('employee_id, full_name, email, branch_id, branches(name, code)')
        .ilike('employee_id', normalizedId)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ found: false })
      }

      const branch = data.branches as unknown as { name: string; code: string } | null

      return NextResponse.json({
        found: true,
        alreadyRegistered: false,
        fullName: data.full_name,
        email: data.email,
        branch: branch?.name ?? branch?.code ?? 'Computer Science & Engineering',
        section: null,
      })
    }

    return NextResponse.json({ found: false })
  } catch (err: unknown) {
    return NextResponse.json(
      { found: false, error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    )
  }
}
