import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function listBranches() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('branches').select('*').order('name')
  if (error) throw error
  return data
}

export async function createBranch(input: { name: string; code: string }) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('branches').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function updateBranch(id: string, input: { name: string; code: string }) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('branches').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deleteBranch(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) throw error
}
