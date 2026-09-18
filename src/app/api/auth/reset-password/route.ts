import { NextResponse, type NextRequest } from 'next/server'
import { verifyOTP } from '@/lib/auth/otp'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildPasswordResetEmailHtml } from '@/lib/email/resend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, otp, newPassword } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const adminClient = createAdminClient()

    if (action === 'send') {
      // 1. Check if user actually exists in profiles or auth
      let userExists = false
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (profile) {
        userExists = true
      } else {
        const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
        userExists = !!usersData?.users?.some((u) => u.email?.toLowerCase() === normalizedEmail)
      }

      if (!userExists) {
        return NextResponse.json(
          { error: 'No registered account found with this email.' },
          { status: 404 }
        )
      }

      // 2. Generate and store 6-digit OTP code in database
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      await adminClient.from('otp_codes').upsert(
        { email: normalizedEmail, code, expires_at: expiresAt, verified: false },
        { onConflict: 'email' }
      )

      // 3. Generate direct Supabase recovery token_hash (bypasses Supabase default mailer)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
      })

      if (linkError) {
        console.warn('[RESET PASSWORD LINK GENERATE WARNING]:', linkError.message)
      }

      const tokenHash = linkData?.properties?.hashed_token

      // 4. Resolve exact origin so links never redirect to unintended localhost
      let origin = body.origin || process.env.NEXT_PUBLIC_SITE_URL
      if (!origin) {
        const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
        const forwardedProto = request.headers.get('x-forwarded-proto') || (forwardedHost?.includes('localhost') ? 'http' : 'https')
        if (forwardedHost) {
          origin = `${forwardedProto}://${forwardedHost}`
        } else {
          origin = 'http://localhost:3000'
        }
      }
      origin = origin.replace(/\/+$/, '')

      const resetUrl = tokenHash
        ? `${origin}/auth/callback?token_hash=${tokenHash}&type=recovery&next=/reset-password`
        : `${origin}/reset-password`

      // 5. Dispatch via Supabase Native Auth Mailer (delivers if Supabase SMTP or custom SMTP is active)
      try {
        await adminClient.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: resetUrl,
        })
      } catch (supaErr: unknown) {
        const supaMsg = supaErr instanceof Error ? supaErr.message : 'Notice'
        console.warn('[SUPABASE AUTH MAILER]:', supaMsg)
      }

      // 6. Also dispatch email with 6-digit OTP code via Resend
      await sendEmail({
        to: normalizedEmail,
        subject: 'Your Password Reset OTP — MREM College Attendance System',
        html: buildPasswordResetEmailHtml({ resetUrl, otp: code }),
      })

      console.log(`[AUTH NOTIFICATION] Password reset 6-digit OTP for ${normalizedEmail}: ${code}`)

      return NextResponse.json({
        success: true,
        message: 'A password reset link and verification code have been sent to your registered email.',
      })
    }

    if (action === 'reset') {
      if (!otp || typeof otp !== 'string') {
        return NextResponse.json({ error: '6-digit code is required' }, { status: 400 })
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters.' },
          { status: 400 }
        )
      }

      // 1. Verify OTP
      const isValidOtp = await verifyOTP(normalizedEmail, otp.trim())
      if (!isValidOtp) {
        return NextResponse.json(
          { error: 'Invalid or expired 6-digit code. Please check and try again.' },
          { status: 400 }
        )
      }

      // 2. Find Auth user ID
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (listError) throw listError

      const authUser = usersData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)
      if (!authUser) {
        return NextResponse.json(
          { error: 'User account not found in authentication system.' },
          { status: 404 }
        )
      }

      // 3. Update password directly
      const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
        password: newPassword.trim(),
      })

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Operation failed' },
      { status: 500 }
    )
  }
}
