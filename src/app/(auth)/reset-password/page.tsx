'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form states
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // OTP fallback states
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  // Status states
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [isResolvingAuth, setIsResolvingAuth] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const resolveSession = async () => {
      try {
        // Check if error is in searchParams
        const errParam = searchParams.get('error') || searchParams.get('error_description')
        if (errParam) {
          setError(decodeURIComponent(errParam))
        }

        // 1. Check if token_hash is in searchParams (direct recovery link)
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')
        if (tokenHash) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || 'recovery',
          })
          if (data?.session && !verifyError) {
            setHasValidSession(true)
            setIsResolvingAuth(false)
            return
          } else if (verifyError) {
            setError(verifyError.message)
          }
        }

        // 2. Check if PKCE code is in searchParams
        const code = searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (!exchangeError) {
            setHasValidSession(true)
            setIsResolvingAuth(false)
            return
          }
        }

        // 2. Check if hash has access_token and refresh_token
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          if (accessToken && refreshToken) {
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (data?.session && !setSessionError) {
              setHasValidSession(true)
              setIsResolvingAuth(false)
              return
            }
          }
        }

        // 3. Check existing Supabase session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasValidSession(true)
        }
      } catch (err) {
        console.warn('Auth resolution warning:', err)
      } finally {
        setIsResolvingAuth(false)
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setHasValidSession(true)
        setIsResolvingAuth(false)
      }
    })

    resolveSession()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [searchParams])

  // Request 6-digit OTP code to email
  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid registered email address first.')
      return
    }

    setError(null)
    setInfoMessage(null)
    setSendingOtp(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: email.trim().toLowerCase() }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to dispatch verification code.')
      }

      setOtpSent(true)
      setInfoMessage('A 6-digit verification code has been dispatched to your email.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.')
    } finally {
      setSendingOtp(false)
    }
  }

  // Handle Password Reset Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
    if (!password) {
      setError('Please enter a new password.')
      return
    }
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters with at least 1 letter and 1 number.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      // Path A: We have a valid Supabase auth session (from email link)
      if (hasValidSession) {
        const supabase = createClient()
        const { error: updateError } = await supabase.auth.updateUser({
          password: password.trim(),
        })

        if (updateError) {
          throw updateError
        }

        setSuccess(true)
        setTimeout(() => {
          router.push('/login?reset=success')
        }, 2000)
        return
      }

      // Path B: Direct OTP-based reset
      if (!email.trim()) {
        setError('Please enter your registered email address to verify password update.')
        setLoading(false)
        return
      }
      if (!otpCode.trim()) {
        setError('Please enter the 6-digit security code sent to your email.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          email: email.trim().toLowerCase(),
          otp: otpCode.trim(),
          newPassword: password.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update password.')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login?reset=success')
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.'
      setError(msg)
      // If session failed, gracefully fall back to OTP entry
      if (hasValidSession && (msg.toLowerCase().includes('expire') || msg.toLowerCase().includes('session') || msg.toLowerCase().includes('auth'))) {
        setHasValidSession(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[430px] glass-panel rounded-2xl p-8 text-gray-900 border border-slate-200/80 shadow-card-lg">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Reset Password</h1>
          <p className="text-xs text-gray-500">Set a new secure password for your account</p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Info message */}
      {infoMessage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-snug">{infoMessage}</span>
        </div>
      )}

      {/* Success State */}
      {success ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Your new password has been saved securely. Redirecting you to sign in...
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-[#0A1931] hover:bg-[#152C5B] text-gray-900 font-semibold text-xs rounded-lg shadow-md transition"
          >
            Continue to Sign In
          </Link>
        </div>
      ) : isResolvingAuth ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-gray-500">Checking secure authorization...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* If no active email link session is detected, offer direct email + 6-digit OTP verification */}
          {!hasValidSession && (
            <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-xl space-y-3 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Account Verification
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Step 1 of 2</span>
              </div>

              <div>
                <label htmlFor="verify-email" className="block text-xs font-semibold text-gray-700 mb-1">
                  Registered Email Address
                </label>
                <div className="flex gap-2">
                  <input
                    id="verify-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email address"
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !email}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition whitespace-nowrap"
                  >
                    {sendingOtp ? 'Sending...' : otpSent ? 'Resend' : 'Send Code'}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div>
                  <label htmlFor="verify-otp" className="block text-xs font-semibold text-gray-700 mb-1">
                    6-Digit Security Code
                  </label>
                  <input
                    id="verify-otp"
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              )}
            </div>
          )}

          {/* New Password */}
          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters (letters + numbers)"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-gray-200 rounded-lg text-gray-800 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 transition"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-gray-200 rounded-lg text-gray-800 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 transition"
                aria-label="Toggle password visibility"
              >
                {showConfirmPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword && password && (
              <p
                className={`text-[11px] mt-1 font-medium ${
                  password === confirmPassword ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !password || password !== confirmPassword}
            className="w-full mt-2 btn-primary text-xs py-2.5 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Save & Update Password</span>
            )}
          </button>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-800 transition hover:underline">
              &larr; Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC] px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* Subtle decorative gradient backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>
      <div className="relative z-10 w-full flex justify-center">
        <Suspense fallback={<div className="text-gray-500 text-xs">Loading reset portal...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
