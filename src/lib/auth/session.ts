import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AuthenticatedUser } from '@/lib/auth/types'

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUserOrNull()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * Resolve the authenticated profile without redirecting — for API routes,
 * which must answer 401 JSON rather than trigger a navigation redirect.
 */
export async function getCurrentUserOrNull(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email,
  }
}
