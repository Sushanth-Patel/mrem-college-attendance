import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const query = (searchParams.get('q') || '').trim()
    const branchCode = searchParams.get('branch') || 'all'
    const year = searchParams.get('year') || 'all'
    const sectionId = searchParams.get('sectionId') || 'all'

    // 1. Fetch Registered Students with Profiles & Sections
    const { data: registeredStudents, error: regError } = await supabase
      .from('students')
      .select(`
        id,
        roll_no,
        account_status,
        attendance_flag,
        joining_date,
        father_name,
        college_name,
        phone_number,
        parent_phone_number,
        dob,
        gender,
        blood_group,
        residence_type,
        bus_route,
        hostel_details,
        address,
        profiles (
          full_name,
          email,
          is_active
        ),
        sections (
          id,
          section_name,
          year_of_study,
          semester,
          academic_year,
          branches (
            id,
            name,
            code
          )
        )
      `)
      .order('roll_no', { ascending: true })

    if (regError) throw regError

    // 2. Fetch Roster Students with Sections
    const { data: rosterStudents, error: rosterError } = await supabase
      .from('roster_students')
      .select(`
        roll_no,
        full_name,
        email,
        father_name,
        college_name,
        matched,
        phone_number,
        parent_phone_number,
        dob,
        gender,
        blood_group,
        residence_type,
        bus_route,
        hostel_details,
        address,
        sections (
          id,
          section_name,
          year_of_study,
          semester,
          academic_year,
          branches (
            id,
            name,
            code
          )
        )
      `)
      .order('roll_no', { ascending: true })

    if (rosterError) throw rosterError

    // 3. Fetch attendance totals for all students
    const { data: attendanceRecords } = await supabase
      .from('attendance_records')
      .select('student_id, status')

    const attendanceByStudent = new Map<string, { present: number; total: number }>()
    if (attendanceRecords) {
      for (const rec of attendanceRecords) {
        const curr = attendanceByStudent.get(rec.student_id) || { present: 0, total: 0 }
        curr.total += 1
        if (rec.status === 'present' || rec.status === 'excused') {
          curr.present += 1
        }
        attendanceByStudent.set(rec.student_id, curr)
      }
    }

    const seenRolls = new Set<string>()
    const enriched: any[] = []

    // Add registered students
    for (const st of registeredStudents || []) {
      const roll = (st.roll_no || '').trim().toUpperCase()
      seenRolls.add(roll)
      const p = (st as any).profiles || {}
      const s = (st as any).sections || {}
      const b = s.branches || {}
      const att = attendanceByStudent.get(st.id) || { present: 0, total: 0 }
      const percentage = att.total > 0 ? Math.round((att.present / att.total) * 100) : 100

      enriched.push({
        id: st.id,
        rollNo: roll,
        fullName: p.full_name || 'Student',
        email: p.email || '',
        fatherName: st.father_name || '',
        collegeName: st.college_name || '',
        branchCode: b.code || 'Dept',
        branchName: b.name || b.code || 'Department',
        yearOfStudy: s.year_of_study || 1,
        semester: s.semester || 'odd',
        sectionName: s.section_name || 'A',
        sectionId: s.id || '',
        phoneNumber: st.phone_number || '',
        parentPhoneNumber: st.parent_phone_number || '',
        dob: st.dob || '',
        gender: st.gender || '',
        bloodGroup: st.blood_group || '',
        residenceType: st.residence_type || 'day_scholar',
        busRoute: st.bus_route || '',
        hostelDetails: st.hostel_details || '',
        address: st.address || '',
        attendancePercentage: percentage,
        totalClasses: att.total,
        attendedClasses: att.present,
        attendanceFlag: st.attendance_flag || 'regular',
        accountStatus: 'active',
        isRegistered: true,
      })
    }

    // Add roster-only students
    for (const r of rosterStudents || []) {
      const roll = (r.roll_no || '').trim().toUpperCase()
      if (seenRolls.has(roll)) continue
      seenRolls.add(roll)

      const s = (r as any).sections || {}
      const b = s.branches || {}

      enriched.push({
        id: `roster-${roll}`,
        rollNo: roll,
        fullName: r.full_name,
        email: r.email,
        fatherName: r.father_name || '',
        collegeName: r.college_name || '',
        branchCode: b.code || 'Dept',
        branchName: b.name || b.code || 'Department',
        yearOfStudy: s.year_of_study || 1,
        semester: s.semester || 'odd',
        sectionName: s.section_name || 'A',
        sectionId: s.id || '',
        phoneNumber: r.phone_number || '',
        parentPhoneNumber: r.parent_phone_number || '',
        dob: r.dob || '',
        gender: r.gender || '',
        bloodGroup: r.blood_group || '',
        residenceType: r.residence_type || 'day_scholar',
        busRoute: r.bus_route || '',
        hostelDetails: r.hostel_details || '',
        address: r.address || '',
        attendancePercentage: 100,
        totalClasses: 0,
        attendedClasses: 0,
        attendanceFlag: 'regular',
        accountStatus: r.matched ? 'active' : 'enrolled_roster',
        isRegistered: r.matched,
      })
    }

    // Apply filtering
    const filtered = enriched.filter((st) => {
      if (branchCode !== 'all' && st.branchCode !== branchCode) return false
      if (year !== 'all' && st.yearOfStudy.toString() !== year) return false
      if (sectionId !== 'all' && st.sectionId !== sectionId) return false
      if (query) {
        const q = query.toLowerCase()
        const matchRoll = st.rollNo.toLowerCase().includes(q)
        const matchName = st.fullName.toLowerCase().includes(q)
        const matchEmail = st.email.toLowerCase().includes(q)
        const matchFather = st.fatherName.toLowerCase().includes(q)
        return matchRoll || matchName || matchEmail || matchFather
      }
      return true
    })

    return NextResponse.json({ success: true, students: filtered, total: filtered.length })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 }
    )
  }
}
