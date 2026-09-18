import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/reset-password'

  const supabase = await createClient()

  // 1. Verify direct token_hash (from custom email reset links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    console.error('[AUTH CALLBACK] verifyOtp error:', error.message)
    return NextResponse.redirect(new URL(`${next}?error=${encodeURIComponent(error.message)}`, request.url))
  }

  // 2. Exchange authorization code if present (PKCE flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    console.error('[AUTH CALLBACK] exchangeCode error:', error.message)
  }

  // If code exchange failed or no code, forward to next target
  return NextResponse.redirect(new URL(next, request.url))
}
