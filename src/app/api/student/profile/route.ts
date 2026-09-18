import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await createClient()

    // Fetch student data with section and branch info
    const { data: student, error } = await supabase
      .from('students')
      .select('*, profiles(avatar_url), sections(*, branches(*))')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        rollNo: student?.roll_no || '',
        fatherName: student?.father_name || '',
        collegeName: student?.college_name || '',
        joiningDate: student?.joining_date || '',
        accountStatus: student?.account_status || 'active',
        attendanceFlag: student?.attendance_flag || 'regular',
        // Editable fields
        phoneNumber: student?.phone_number || '',
        parentPhoneNumber: student?.parent_phone_number || '',
        dob: student?.dob || '',
        gender: student?.gender || '',
        bloodGroup: student?.blood_group || '',
        residenceType: student?.residence_type || 'day_scholar',
        busRoute: student?.bus_route || '',
        hostelDetails: student?.hostel_details || '',
        address: student?.address || '',
        avatarUrl: (student?.profiles as unknown as { avatar_url?: string } | null)?.avatar_url || '',
        // Academic section
        section: student?.sections || null,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      phoneNumber,
      parentPhoneNumber,
      dob,
      gender,
      bloodGroup,
      residenceType,
      busRoute,
      hostelDetails,
      address,
      avatarUrl,
    } = body

    // Phone numbers feed attendance/detention alerts — reject anything that
    // isn't 10–13 digits (spaces/dashes/parens tolerated, optional + prefix).
    const normalizedPhone = (v: unknown) =>
      typeof v === 'string' ? v.replace(/[\s()-]/g, '') : ''
    const PHONE_RE = /^\+?\d{10,13}$/
    if (phoneNumber && !PHONE_RE.test(normalizedPhone(phoneNumber))) {
      return NextResponse.json(
        { error: 'Invalid student mobile number — use 10–13 digits (optionally starting with +).' },
        { status: 400 }
      )
    }
    if (parentPhoneNumber && !PHONE_RE.test(normalizedPhone(parentPhoneNumber))) {
      return NextResponse.json(
        { error: 'Invalid parent mobile number — use 10–13 digits (optionally starting with +).' },
        { status: 400 }
      )
    }

    // Profile edits run through the service-role client: RLS keeps the
    // students table admin-writable only, and this route's own role guard
    // scopes every write to the authenticated user's own row.
    const supabase = createAdminClient()

    // Update students table
    const { error: studentError } = await supabase
      .from('students')
      .update({
        phone_number: phoneNumber?.trim() || null,
        parent_phone_number: parentPhoneNumber?.trim() || null,
        dob: dob || null,
        gender: gender || null,
        blood_group: bloodGroup || null,
        residence_type: residenceType || 'day_scholar',
        bus_route: residenceType === 'day_scholar' ? busRoute?.trim() || null : null,
        hostel_details: residenceType === 'hosteller' ? hostelDetails?.trim() || null : null,
        address: address?.trim() || null,
      })
      .eq('id', user.id)

    if (studentError) throw studentError

    // Also update phone_number and avatar_url in profiles table
    const profileUpdates: { phone_number?: string; avatar_url?: string } = {}
    if (phoneNumber) {
      profileUpdates.phone_number = phoneNumber.trim()
    }
    if (typeof avatarUrl === 'string') {
      profileUpdates.avatar_url = avatarUrl
    }
    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update profile' },
      { status: 500 }
    )
  }
}
