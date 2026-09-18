import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRollNumber } from '@/lib/academic'

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json()

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 })
    }

    const cleanId = normalizeRollNumber(identifier)
    const supabase = createAdminClient()

    // 1. Check if identifier is already a direct email
    if (cleanId.includes('@')) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email, role')
        .ilike('email', cleanId.toLowerCase())
        .maybeSingle()

      if (prof?.email) {
        return NextResponse.json({ found: true, email: prof.email.toLowerCase(), role: prof.role })
      }
      // Return email as is so Supabase auth can validate password
      return NextResponse.json({ found: true, email: cleanId.toLowerCase() })
    }

    // 2. Look up student by roll_no
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('roll_no', cleanId)
      .maybeSingle()

    if (student?.id) {
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('id', student.id)
        .maybeSingle()

      if (studentProfile?.email) {
      return NextResponse.json({
        found: true,
        email: studentProfile.email.toLowerCase(),
        role: studentProfile.role || 'student',
      })
      }
    }

    // 3. Look up faculty by employee_id
    const { data: faculty } = await supabase
      .from('faculty')
      .select('id')
      .ilike('employee_id', cleanId)
      .maybeSingle()

    if (faculty?.id) {
      const { data: facultyProfile } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('id', faculty.id)
        .maybeSingle()

      if (facultyProfile?.email) {
      return NextResponse.json({
        found: true,
        email: facultyProfile.email.toLowerCase(),
        role: facultyProfile.role || 'faculty',
      })
      }
    }

    // 4. Look up in roster_students
    const { data: studentRoster } = await supabase
      .from('roster_students')
      .select('email')
      .ilike('roll_no', cleanId)
      .maybeSingle()

    if (studentRoster?.email) {
      return NextResponse.json({ found: true, email: studentRoster.email.toLowerCase(), role: 'student' })
    }

    // 5. Look up in roster_faculty
    const { data: facultyRoster } = await supabase
      .from('roster_faculty')
      .select('email')
      .ilike('employee_id', cleanId)
      .maybeSingle()

    if (facultyRoster?.email) {
      return NextResponse.json({ found: true, email: facultyRoster.email.toLowerCase(), role: 'faculty' })
    }

    return NextResponse.json({
      found: false,
      error: `No registered student or staff record found for "${cleanId.toUpperCase()}".`,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { found: false, error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    )
  }
}
