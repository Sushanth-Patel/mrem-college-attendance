'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton({
  className = 'p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs flex items-center gap-1.5',
  showText = true,
  showIcon = true,
  title = 'Sign Out',
}: {
  className?: string
  showText?: boolean
  showIcon?: boolean
  title?: string
}) {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (signingOut) return
    setSigningOut(true)

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Sign out error:', err)
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className={className}
      title={title}
      type="button"
      aria-label="Sign out"
    >
      {showIcon && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      )}
      {showText && <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>}
    </button>
  )
}
