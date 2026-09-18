'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signup } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/client'
import { normalizeRollNumber } from '@/lib/academic'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialRole = searchParams.get('role') === 'faculty' ? 'faculty' : 'student'
  const [userType, setUserType] = useState<'student' | 'faculty'>(initialRole)

  // 4 Fields
  const [email, setEmail] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI helpers & toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Roster lookup state
  const [rosterInfo, setRosterInfo] = useState<{
    fullName: string
    email: string
    branch?: string
    section?: string | null
    alreadyRegistered?: boolean
  } | null>(null)
  const [lookingUpRoster, setLookingUpRoster] = useState(false)
  const [rosterSearched, setRosterSearched] = useState(false)

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    identifier?: string
    password?: string
    confirmPassword?: string
  }>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Step state: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form')
  const [otpCode, setOtpCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)

  useEffect(() => {
    const roleParam = searchParams.get('role')
    if (roleParam === 'faculty') setUserType('faculty')
    else if (roleParam === 'student') setUserType('student')
  }, [searchParams])

  const handleLookupRoster = async (idInput: string) => {
    const cleanId = normalizeRollNumber(idInput)
    if (cleanId.length < 3) {
      setRosterInfo(null)
      setRosterSearched(false)
      return
    }

    setLookingUpRoster(true)
    try {
      const res = await fetch('/api/roster-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: userType, identifier: cleanId }),
      })
      const data = await res.json()
      if (data.found) {
        setRosterInfo(data)
        if (data.email && !email.trim()) {
          setEmail(data.email)
        }
      } else {
        setRosterInfo(null)
      }
      setRosterSearched(true)
    } catch {
      // Non-blocking
    } finally {
      setLookingUpRoster(false)
    }
  }

  const validateForm = () => {
    const errors: { email?: string; identifier?: string; password?: string; confirmPassword?: string } = {}

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      errors.email = 'Email address is required'
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email format (e.g. name@gmail.com)'
    }

    if (!identifier.trim()) {
      errors.identifier = userType === 'student' ? 'Roll Number is required' : 'Faculty ID is required'
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
    if (!password) {
      errors.password = 'Password is required'
    } else if (!passwordRegex.test(password)) {
      errors.password = 'Must be at least 8 characters with at least 1 letter and 1 number'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm password is required'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (rosterInfo?.alreadyRegistered) {
      router.push(`/login?id=${encodeURIComponent(identifier.trim())}&role=${userType}`)
      return
    }

    if (!validateForm()) return

    setSubmitting(true)

    try {
      await signup({
        role: userType,
        fullName: rosterInfo?.fullName || identifier.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        identifier: normalizeRollNumber(identifier),
        password,
        confirmPassword,
      })

      setStep('success')
      setTimeout(() => {
        router.push(`/login?registered=true&role=${userType}&id=${encodeURIComponent(identifier.trim())}`)
      }, 2000)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
        }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Invalid or expired OTP code.')
      }

      setStep('success')

      // Automatically sign in the user to establish browser session and redirect to dashboard
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      setTimeout(() => {
        if (!signInErr) {
          window.location.href = userType === 'student' ? '/student/dashboard' : '/faculty/dashboard'
        } else {
          window.location.href = `/login?registered=true&role=${userType}`
        }
      }, 1000)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Verification failed. Please check the code.')
    } finally {
      setSubmitting(false)
    }
  }

  const isStudent = userType === 'student'

  return (
    <div className="w-full max-w-[440px] glass-panel rounded-2xl p-8 text-gray-900 border border-slate-200/80 shadow-card-lg">
      {/* State: Success */}
      {step === 'success' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Verified!</h2>
          <p className="text-xs text-gray-500 mb-6">
            Your registration is active. Redirecting you to sign in...
          </p>
          <Link
            href={`/login?role=${userType}`}
            className="inline-block btn-primary text-xs"
          >
            Continue to Sign In
          </Link>
        </div>
      )}

      {/* State: OTP Verification */}
      {step === 'otp' && (
        <div>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Email Verification</h2>
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code sent to <strong className="text-gray-800">{email}</strong>
            </p>
          </div>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {serverError}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp-code-input" className="block text-xs font-medium text-gray-700 text-center mb-2">
                6-Digit Security Code
              </label>
              <input
                id="otp-code-input"
                type="text"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center text-2xl tracking-[0.4em] py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition"
              />
              {devOtpHint && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpHint)}
                    className="text-[11px] text-blue-600 hover:underline font-mono font-semibold"
                  >
                    ⚡ Autofill Code: {devOtpHint}
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || otpCode.length < 6}
              className="w-full btn-primary text-xs py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Verifying...' : 'Verify Code & Finish'}
            </button>
          </form>
        </div>
      )}

      {/* State: Main Form */}
      {step === 'form' && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Create Account</h1>
              <p className="text-xs text-gray-500">MREM Institutional Registration</p>
            </div>
          </div>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Role Selector - Zillow segmented cards */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Registering As:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setUserType('student')
                    setFieldErrors({})
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    isStudent
                      ? 'bg-blue-50/80 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isStudent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-xs block leading-tight">Student</span>
                    <span className="text-[10px] text-gray-500">Roll Number</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserType('faculty')
                    setFieldErrors({})
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    !isStudent
                      ? 'bg-blue-50/80 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    !isStudent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-xs block leading-tight">Faculty</span>
                    <span className="text-[10px] text-gray-500">Staff / Emp ID</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Field 1: Identifier (Roll No / Faculty ID) */}
            <div>
              <label htmlFor="signup-identifier-input" className="block text-xs font-semibold text-gray-700 mb-1.5">
                {isStudent ? 'College Roll Number' : 'Faculty Employee ID'}
              </label>
              <input
                id="signup-identifier-input"
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(normalizeRollNumber(e.target.value))
                  if (fieldErrors.identifier) setFieldErrors({ ...fieldErrors, identifier: undefined })
                }}
                onBlur={() => handleLookupRoster(identifier)}
                placeholder={isStudent ? 'Enter Roll Number' : 'Enter Employee ID'}
                aria-invalid={!!fieldErrors.identifier}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-800 text-xs uppercase placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition font-mono font-semibold"
              />
              
              {lookingUpRoster && (
                <p className="text-[11px] text-blue-600 mt-1 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Checking roster database...
                </p>
              )}

              {rosterInfo && rosterInfo.alreadyRegistered && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">ℹ</span>
                    Account Already Registered
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1">
                    An active account exists for <strong>{rosterInfo.fullName}</strong>. Please sign in to continue.
                  </p>
                  <div className="mt-2">
                    <Link
                      href={`/login?id=${encodeURIComponent(identifier.trim())}&role=${userType}`}
                      className="inline-block btn-primary text-xs py-1.5 px-3 rounded-lg"
                    >
                      Sign In Now &rarr;
                    </Link>
                  </div>
                </div>
              )}

              {rosterInfo && !rosterInfo.alreadyRegistered && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">✓</span>
                    {rosterInfo.fullName}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    {rosterInfo.branch} {rosterInfo.section ? `• ${rosterInfo.section}` : ''}
                  </p>
                </div>
              )}

              {!lookingUpRoster && rosterSearched && !rosterInfo && (
                <p className="text-[11px] text-gray-600 bg-slate-50 border border-gray-200 rounded-md p-1.5 mt-1 font-medium">
                  Direct Registration • Your institutional account will be active immediately
                </p>
              )}

              {fieldErrors.identifier && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.identifier}</p>
              )}
            </div>

            {/* Field 2: Email Address */}
            <div>
              <label htmlFor="signup-email-input" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="signup-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
                }}
                placeholder="Enter your email address"
                aria-invalid={!!fieldErrors.email}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-800 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            {/* Field 3: Password */}
            <div>
              <label htmlFor="signup-password-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                  }}
                  placeholder="Min 8 characters (letters + numbers)"
                  aria-invalid={!!fieldErrors.password}
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
              {fieldErrors.password && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            {/* Field 4: Confirm Password */}
            <div>
              <label htmlFor="signup-confirm-password-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined })
                  }}
                  placeholder="Repeat password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-gray-200 rounded-lg text-gray-800 text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 transition"
                  aria-label="Toggle confirm password visibility"
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
                <p className={`text-[11px] mt-1 font-medium ${
                  password === confirmPassword ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !!rosterInfo?.alreadyRegistered}
              className="w-full mt-3 btn-primary text-xs py-2.5 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Registering...</span>
                </>
              ) : rosterInfo?.alreadyRegistered ? (
                <span>Account Already Registered (Click to Sign In)</span>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-5 text-center text-xs text-gray-500 pt-4 border-t border-gray-100">
            Already have an account?{' '}
            <Link
              href={`/login?role=${userType}`}
              className="text-blue-600 hover:text-blue-800 font-bold transition hover:underline ml-1"
            >
              Sign In
            </Link>
          </div>

          <div className="mt-3 text-center">
            <Link href="/" className="text-xs text-gray-600 hover:text-gray-600 transition">
              &larr; Back to Home
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC] px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* Subtle decorative gradient backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-100/30 rounded-full blur-3xl translate-y-1/3 translate-x-1/4" />
      </div>
      <div className="relative z-10 w-full flex justify-center">
        <Suspense fallback={<div className="text-gray-500 text-xs">Loading registration portal...</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  )
}
