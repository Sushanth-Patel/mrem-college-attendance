import { NextResponse, type NextRequest } from 'next/server'
import { generateAndSendOTP, verifyOTP } from '@/lib/auth/otp'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { action, email, code } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (action === 'send') {
      // Limit to 5 OTP requests per email every 10 minutes
      const limiter = checkRateLimit({
        key: `otp-send:${normalizedEmail}`,
        maxRequests: 5,
        windowSeconds: 600,
      })

      if (!limiter.success) {
        return NextResponse.json(
          {
            error: `Too many OTP requests. Please wait ${limiter.resetInSeconds} seconds before trying again.`,
          },
          { status: 429 }
        )
      }

      const code = await generateAndSendOTP(normalizedEmail)
      // The OTP is delivered by email; echoing it back is a dev-only convenience
      // and must never reach a deployed environment.
      const isDev = process.env.NODE_ENV !== 'production'
      return NextResponse.json({
        success: true,
        message: 'OTP sent to your email address.',
        ...(isDev ? { devCode: code } : {}),
      })
    } else if (action === 'verify') {
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: '6-digit OTP code is required' }, { status: 400 })
      }

      // Limit to 10 verification attempts per email every 10 minutes
      const limiter = checkRateLimit({
        key: `otp-verify:${normalizedEmail}`,
        maxRequests: 10,
        windowSeconds: 600,
      })

      if (!limiter.success) {
        return NextResponse.json(
          {
            error: `Too many verification attempts. Please wait ${limiter.resetInSeconds} seconds.`,
          },
          { status: 429 }
        )
      }

      const isValid = await verifyOTP(normalizedEmail, code.trim())
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Invalid or expired OTP code' }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'OTP verified successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OTP operation failed' },
      { status: 500 }
    )
  }
}
