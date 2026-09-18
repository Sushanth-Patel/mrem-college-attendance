import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export async function listPendingSignupRequests() {
  await requireAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listAllSignupRequests(filters?: {
  status?: 'pending' | 'approved' | 'rejected'
  limit?: number
}) {
  await requireAdmin()
  const supabase = await createClient()

  let query = supabase
    .from('signup_requests')
    .select('*, profiles:reviewed_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function approveSignupRequest(
  requestId: string,
  matchedRosterId: string
) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: request, error: requestError } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (requestError || !request) {
    throw requestError ?? new Error('Signup request not found or already reviewed')
  }

  // Update the request status
  const { error: updateError } = await supabase
    .from('signup_requests')
    .update({
      status: 'approved',
      matched_roster_id: matchedRosterId,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) throw updateError

  // The actual account creation + OTP step will be triggered
  // from the UI after the admin approves — the approve action
  // just moves the request to 'approved' status and associates
  // the correct roster ID. The OTP email is sent next.
}

export async function rejectSignupRequest(requestId: string, reason: string) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('signup_requests')
    .update({
      status: 'rejected',
      review_reason: reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) throw error
}
