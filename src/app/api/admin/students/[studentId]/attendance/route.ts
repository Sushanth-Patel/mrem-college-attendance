import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    await requireAdmin()
    const { studentId } = params
    const supabase = await createClient()

    let student: any = null

    if (studentId.startsWith('roster-')) {
      const rollNo = studentId.replace('roster-', '')
      const { data: roster, error: rosterError } = await supabase
        .from('roster_students')
        .select(`
          roll_no,
          full_name,
          email,
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
          sections (
            id,
            section_name,
            year_of_study,
            semester,
            academic_year,
            branches (
              name,
              code
            )
          )
        `)
        .ilike('roll_no', rollNo)
        .maybeSingle()

      if (rosterError || !roster) {
        return NextResponse.json({ error: 'Student not found in roster' }, { status: 404 })
      }

      student = {
        id: studentId,
        roll_no: roster.roll_no,
        account_status: 'enrolled_roster',
        attendance_flag: 'regular',
        joining_date: new Date().toISOString().split('T')[0],
        father_name: roster.father_name,
        college_name: roster.college_name || '',
        phone_number: roster.phone_number,
        parent_phone_number: roster.parent_phone_number,
        dob: roster.dob,
        gender: roster.gender,
        blood_group: roster.blood_group,
        residence_type: roster.residence_type,
        bus_route: roster.bus_route,
        hostel_details: roster.hostel_details,
        address: roster.address,
        profiles: {
          full_name: roster.full_name,
          email: roster.email,
          is_active: true,
        },
        sections: roster.sections,
      }
    } else {
      // Fetch from students table
      const { data: st, error: studentError } = await supabase
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
              name,
              code
            )
          )
        `)
        .eq('id', studentId)
        .maybeSingle()

      if (studentError || !st) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
      student = st
    }

    // 2. Fetch Attendance Records for this Student
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        session_id,
        sessions (
          id,
          session_date,
          period_number,
          subject_id,
          actual_faculty_id,
          subjects (
            code,
            name
          ),
          faculty (
            profiles (
              full_name
            )
          )
        )
      `)
      .eq('student_id', studentId)

    if (recordsError) throw recordsError

    // 3. Compute Aggregates & Subject Breakdown
    let totalSessions = 0
    let presentCount = 0
    let absentCount = 0
    let excusedCount = 0

    const subjectMap = new Map<
      string,
      { code: string; name: string; total: number; attended: number; absent: number }
    >()

    const timeline = (records || []).map((rec: any) => {
      const sess = rec.sessions || {}
      const subj = sess.subjects || { code: 'N/A', name: 'General Session' }
      const facProfile = sess.faculty?.profiles || { full_name: 'Faculty' }

      totalSessions += 1
      const isAttended = rec.status === 'present' || rec.status === 'excused'
      if (rec.status === 'present') presentCount += 1
      else if (rec.status === 'absent') absentCount += 1
      else if (rec.status === 'excused') excusedCount += 1

      // Group by subject
      const subjectKey = sess.subject_id || subj.code
      const currSubject = subjectMap.get(subjectKey) || {
        code: subj.code,
        name: subj.name,
        total: 0,
        attended: 0,
        absent: 0,
      }
      currSubject.total += 1
      if (isAttended) currSubject.attended += 1
      else currSubject.absent += 1
      subjectMap.set(subjectKey, currSubject)

      return {
        id: rec.id,
        status: rec.status,
        date: sess.session_date,
        periodNumber: sess.period_number,
        subjectCode: subj.code,
        subjectName: subj.name,
        facultyName: facProfile.full_name,
      }
    })

    // Sort timeline newest first
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const overallPercentage =
      totalSessions > 0 ? Math.round(((presentCount + excusedCount) / totalSessions) * 100) : 100

    const subjectsBreakdown = Array.from(subjectMap.values()).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.attended / s.total) * 100) : 100,
    }))

    const p = (student as any).profiles || {}
    const s = (student as any).sections || {}
    const b = s.branches || {}

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        rollNo: student.roll_no,
        fullName: p.full_name || 'Student',
        email: p.email || '',
        fatherName: student.father_name || '',
        collegeName: student.college_name || '',
        branchCode: b.code || 'Dept',
        branchName: b.name || b.code || 'Department',
        yearOfStudy: s.year_of_study || 1,
        semester: s.semester || 'odd',
        sectionName: s.section_name || 'A',
        academicYear: s.academic_year || '2025-2026',
        joiningDate: student.joining_date,
        accountStatus: student.account_status,
        attendanceFlag: student.attendance_flag,
        phoneNumber: student.phone_number || '',
        parentPhoneNumber: student.parent_phone_number || '',
        dob: student.dob || '',
        gender: student.gender || '',
        bloodGroup: student.blood_group || '',
        residenceType: student.residence_type || 'day_scholar',
        busRoute: student.bus_route || '',
        hostelDetails: student.hostel_details || '',
        address: student.address || '',
      },
      analytics: {
        overallPercentage,
        totalSessions,
        presentCount,
        absentCount,
        excusedCount,
        statusLabel:
          overallPercentage >= 75
            ? 'Normal (Safe)'
            : overallPercentage >= 65
            ? 'Condonation Risk'
            : 'Detained Alert (<65%)',
        statusColor:
          overallPercentage >= 75
            ? 'emerald'
            : overallPercentage >= 65
            ? 'amber'
            : 'rose',
      },
      subjectsBreakdown,
      timeline,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load attendance dossier' },
      { status: 500 }
    )
  }
}
