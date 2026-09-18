'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeRollNumber } from '@/lib/academic'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('type=recovery')) {
        window.location.replace('/reset-password' + window.location.hash)
      } else if (window.location.search.includes('code=')) {
        window.location.replace('/auth/callback' + window.location.search)
      }
    }
  }, [])

  const resetSuccess = searchParams.get('reset') === 'success'
  const registeredSuccess = searchParams.get('registered') === 'true'
  const initialId = searchParams.get('id') || searchParams.get('identifier') || ''

  const [identifier, setIdentifier] = useState(initialId)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const cleanInput = identifier.includes('@') ? identifier.trim() : normalizeRollNumber(identifier)
    if (!cleanInput) {
      setError('Please enter your email, roll number, or faculty ID')
      setLoading(false)
      return
    }

    try {
      let resolvedEmail = cleanInput.toLowerCase()

      // If user provided a Roll Number or Employee ID (no @), resolve email via server
      if (!cleanInput.includes('@')) {
        const res = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanInput }),
        })
        const resolveData = await res.json()

        if (resolveData.found && resolveData.email) {
          resolvedEmail = resolveData.email.toLowerCase()
        } else {
          throw new Error(resolveData.error || `No account found for "${cleanInput.toUpperCase()}".`)
        }
      }

      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })

      if (authError || !data.user) {
        throw new Error(authError?.message || 'Invalid credentials. Please verify your password.')
      }

      // Check if there is a 'next' query param for redirection
      const nextParam = searchParams.get('next')
      if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
        window.location.href = nextParam
        return
      }

      // Check profile role directly from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      const userRole = (profile?.role || 'student').toLowerCase()

      if (userRole === 'student') {
        window.location.href = '/student/dashboard'
      } else if (['admin', 'super_admin', 'hod', 'principal'].includes(userRole)) {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/today'
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[400px] glass-panel rounded-2xl p-8 text-gray-900 border border-slate-200/80 shadow-card-lg">
      {/* Top Header */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Welcome Back</h1>
          <p className="text-xs text-gray-500">Sign in to your MREM portal</p>
        </div>
      </div>

      {resetSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="leading-snug">Password updated successfully! Please sign in with your new password.</span>
        </div>
      )}

      {registeredSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="leading-snug">Registration successful! Please sign in to access your portal.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email / Roll No / Faculty ID */}
        <div>
          <label htmlFor="login-identifier" className="block text-xs font-medium text-gray-700 mb-1.5">
            Email / Roll No / Faculty ID
          </label>
          <input
            id="login-identifier"
            type="text"
            required
            value={identifier}
            onChange={(e) => {
              const val = e.target.value
              setIdentifier(val.includes('@') ? val : normalizeRollNumber(val))
            }}
            placeholder="Roll Number, Faculty ID, or Email"
            className="input-clean font-mono font-medium text-xs"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="block text-xs font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input-clean pr-10 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-600 transition"
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

        {/* Forgot Password */}
        <div className="text-left pt-0.5">
          <Link
            href="/forgot-password"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Logging in...</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </button>
      </form>

      {/* Footer Register Link */}
      <div className="mt-6 text-center text-xs text-gray-500 pt-4 border-t border-gray-100">
        Don&apos;t have an account?{' '}
        <Link
          href={searchParams.get('role') ? `/signup?role=${searchParams.get('role')}` : '/signup'}
          className="text-blue-600 hover:text-blue-800 font-semibold transition hover:underline ml-1"
        >
          Register
        </Link>
      </div>

      <div className="mt-3 text-center">
        <Link href="/" className="text-xs text-gray-600 hover:text-gray-600 transition">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC] px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* Subtle decorative gradient backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>
      <div className="relative z-10 w-full flex justify-center">
        <Suspense fallback={<div className="text-gray-500 text-xs">Loading login portal...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
