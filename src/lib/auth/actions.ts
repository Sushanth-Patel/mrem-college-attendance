'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildPasswordResetEmailHtml } from '@/lib/email/resend'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/validators'

type SignupResult = { status: 'created'; userId?: string }

function normalizeSupabaseError(error: { code?: string; message: string }) {
  if (
    error.code === 'PGRST202' ||
    error.message.includes('find_student_roster_for_signup') ||
    error.message.includes('find_faculty_roster_for_signup')
  ) {
    return new Error(
      'Registration setup is incomplete. Apply the latest Supabase migrations, including the signup lookup functions, then try again.'
    )
  }
  if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
    return new Error(
      'Cannot reach Supabase. Update NEXT_PUBLIC_SUPABASE_URL in .env.local to the current project URL, then restart the dev server.'
    )
  }
  if (error.code === '42883' || error.message.includes('does not exist')) {
    return new Error(
      'Supabase migrations are incomplete. Apply the latest migrations, including the signup lookup functions.'
    )
  }
  return error
}

export async function login(input: LoginInput) {
  const payload = loginSchema.parse(input)
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  })

  if (error) {
    throw error
  }
}

export async function signup(input: SignupInput): Promise<SignupResult> {
  const payload = signupSchema.parse(input)
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const normalizedEmail = payload.email.trim().toLowerCase()
  const normalizedIdentifier = payload.identifier.trim().toUpperCase()

  if (payload.role === 'student') {
    // 1. Check if roll number or email is already registered
    const { data: existingStudent } = await adminClient
      .from('students')
      .select('id, roll_no')
      .ilike('roll_no', normalizedIdentifier)
      .maybeSingle()

    if (existingStudent) {
      throw new Error(`Roll number ${normalizedIdentifier} is already registered. Please sign in instead.`)
    }

    const { data: existingEmail } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingEmail) {
      throw new Error('An account with this email already exists. Please sign in instead.')
    }

    // 2. Optional roster check to enrich data (name, section, joining_date)
    let studentName = payload.fullName?.trim() || `Student ${normalizedIdentifier}`
    let sectionId: string | null = null
    let joiningDate = new Date().toISOString().split('T')[0]

    try {
      const { data: rosterRows } = await adminClient.rpc('find_student_roster_for_signup', {
        p_roll_no: normalizedIdentifier,
        p_email: normalizedEmail,
      })
      let roster = rosterRows?.[0]

      // Fallback: If user signs up with @gmail.com or another email that differs from initial roster upload,
      // match by roll number directly so their correct section, name, and term start date are retained.
      if (!roster) {
        const { data: rosterByRoll } = await adminClient
          .from('roster_students')
          .select('roll_no, full_name, email, section_id, sections(term_start_date)')
          .ilike('roll_no', normalizedIdentifier)
          .maybeSingle()

        if (rosterByRoll) {
          const sec = rosterByRoll.sections as unknown as { term_start_date: string } | null
          roster = {
            roll_no: rosterByRoll.roll_no,
            full_name: rosterByRoll.full_name,
            email: rosterByRoll.email,
            section_id: rosterByRoll.section_id,
            term_start_date: sec?.term_start_date || null,
          }
        }
      }

      if (roster) {
        if (roster.full_name) studentName = roster.full_name
        if (roster.section_id) sectionId = roster.section_id
        if (roster.term_start_date) joiningDate = roster.term_start_date

        // Sync roster_students email with newly registered email if different
        if (roster.email?.toLowerCase() !== normalizedEmail) {
          await adminClient
            .from('roster_students')
            .update({ email: normalizedEmail })
            .ilike('roll_no', normalizedIdentifier)
        }
      }
    } catch {
      // Non-blocking: roster lookup is purely optional enrichment
    }

    // If sectionId is still null, associate with the first active section so foreign key is satisfied
    if (!sectionId) {
      const { data: defaultSec } = await adminClient
        .from('sections')
        .select('id, term_start_date')
        .eq('is_active', true)
        .order('year_of_study', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (defaultSec) {
        sectionId = defaultSec.id
        if (defaultSec.term_start_date) joiningDate = defaultSec.term_start_date
      }
    }

    if (!sectionId) {
      const { data: anySec } = await adminClient.from('sections').select('id').limit(1).single()
      sectionId = anySec?.id
    }

    // 3. Create or resolve the Auth user with email auto-confirmed
    let userId: string | undefined
    const { data: authData, error: signupError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: studentName,
        role: 'student',
      },
    })

    if (signupError) {
      const errMsg = signupError.message?.toLowerCase() || ''
      if (errMsg.includes('already') || signupError.code === 'email_exists') {
        // An auth user already owns this email. Signup must NOT adopt it by
        // resetting its password — that would let anyone who knows a
        // registered address take the account over with an unused roll number.
        // Only an orphaned auth user (no profile row, i.e. an abandoned
        // half-finished signup) may be reclaimed, and even then the reclaim is
        // re-checked against the live profiles table rather than assumed from
        // the earlier read.
        const { data: conflictingProfile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (conflictingProfile) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        }

        const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const found = usersData?.users.find((u) => u.email?.toLowerCase() === normalizedEmail)
        if (!found) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        }

        const { data: profileForUser } = await adminClient
          .from('profiles')
          .select('id')
          .eq('id', found.id)
          .maybeSingle()
        if (profileForUser) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        }

        userId = found.id
        await adminClient.auth.admin.updateUserById(userId, {
          password: payload.password,
          email_confirm: true,
          user_metadata: { full_name: studentName, role: 'student' },
        })
      } else {
        throw signupError
      }
    } else {
      userId = authData.user.id
    }

    if (!userId) {
      throw new Error('Registration failed. Please try again.')
    }

    // 4. Upsert Profile
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: userId,
      role: 'student',
      full_name: studentName,
      email: normalizedEmail,
    })
    if (profileError) throw profileError

    // 5. Upsert Student Record
    const { error: studentError } = await adminClient.from('students').upsert({
      id: userId,
      roll_no: normalizedIdentifier,
      section_id: sectionId,
      joining_date: joiningDate,
      account_status: 'active',
    })
    if (studentError) throw studentError

    return { status: 'created', userId }
  }

  // -------------------------------------------------------------
  // Faculty Flow: Direct Registration without Admin Approval
  // -------------------------------------------------------------
  const { data: existingFaculty } = await adminClient
    .from('faculty')
    .select('id, employee_id')
    .ilike('employee_id', normalizedIdentifier)
    .maybeSingle()

  if (existingFaculty) {
    throw new Error(`Faculty ID ${normalizedIdentifier} is already registered. Please sign in instead.`)
  }

  const { data: existingFacultyEmail } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingFacultyEmail) {
    throw new Error('An account with this email already exists. Please sign in instead.')
  }

  let facultyName = payload.fullName?.trim() || `Faculty ${normalizedIdentifier}`
  let branchId: string | null = null

  try {
    const { data: rosterRows } = await adminClient.rpc('find_faculty_roster_for_signup', {
      p_employee_id: normalizedIdentifier,
      p_email: normalizedEmail,
    })
    let roster = rosterRows?.[0]

    // Fallback: If faculty signs up with @gmail.com or another email that differs from initial roster upload,
    // match by employee_id directly so their full name and assigned branch are retained.
    if (!roster) {
      const { data: rosterById } = await adminClient
        .from('roster_faculty')
        .select('employee_id, full_name, email, branch_id')
        .ilike('employee_id', normalizedIdentifier)
        .maybeSingle()

      if (rosterById) {
        roster = rosterById
      }
    }

    if (roster) {
      if (roster.full_name) facultyName = roster.full_name
      if (roster.branch_id) branchId = roster.branch_id

      // Sync roster_faculty email with newly registered email if different
      if (roster.email?.toLowerCase() !== normalizedEmail) {
        await adminClient
          .from('roster_faculty')
          .update({ email: normalizedEmail })
          .ilike('employee_id', normalizedIdentifier)
      }
    }
  } catch {
    // Non-blocking
  }

  if (!branchId) {
    const { data: anyBranch } = await adminClient.from('branches').select('id').limit(1).maybeSingle()
    branchId = anyBranch?.id ?? null
  }

  // Create or resolve Supabase Auth User directly
  let userId: string | undefined
  const { data: authData, error: signupError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      full_name: facultyName,
      role: 'faculty',
    },
  })

  if (signupError) {
    const errMsg = signupError.message?.toLowerCase() || ''
    if (errMsg.includes('already') || signupError.code === 'email_exists') {
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (existingProfile) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = usersData?.users.find((u) => u.email?.toLowerCase() === normalizedEmail)
      if (!found) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      // Same rule as the student path: only an auth user with no profile row
      // at all is an abandoned signup that may be reclaimed.
      const { data: profileForUser } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', found.id)
        .maybeSingle()
      if (profileForUser) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      userId = found.id
      await adminClient.auth.admin.updateUserById(userId, {
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: facultyName, role: 'faculty' },
      })
    } else {
      throw signupError
    }
  } else {
    userId = authData.user.id
  }

  if (!userId) {
    throw new Error('Registration failed. Please try again.')
  }

  // Upsert Profile
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: userId,
    role: 'faculty',
    full_name: facultyName,
    email: normalizedEmail,
  })
  if (profileError) throw profileError

  // Upsert Faculty Record
  const { error: facultyError } = await adminClient.from('faculty').upsert({
    id: userId,
    employee_id: normalizedIdentifier,
    branch_id: branchId,
  })
  if (facultyError) throw facultyError

  return { status: 'created', userId }
}

export async function requestPasswordReset(email: string, redirectTo?: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const origin = (redirectTo || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

  try {
    const adminClient = createAdminClient()
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    })

    if (!linkError && linkData?.properties?.hashed_token) {
      const resetUrl = `${origin}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`
      await sendEmail({
        to: normalizedEmail,
        subject: 'Password Reset Request — MREM College Attendance System',
        html: buildPasswordResetEmailHtml({ resetUrl }),
      })
      return
    }
  } catch (err) {
    console.warn('[SERVER ACTION PASSWORD RESET WARNING]:', err)
  }

  // Fallback to standard client reset
  const supabase = await createClient()
  const targetUrl = origin ? (origin.endsWith('/reset-password') ? origin : `${origin}/reset-password`) : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    targetUrl ? { redirectTo: targetUrl } : undefined
  )
  if (error) throw error
}
