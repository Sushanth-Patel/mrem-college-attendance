import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

type SubjectInput = {
  branch_id: string
  year_of_study: number
  semester: 'odd' | 'even'
  code: string
  name: string
  subject_type: 'theory' | 'lab' | 'project'
  track_attendance?: boolean
}

export async function listSubjects() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select('*, branches(name, code)')
    .order('year_of_study', { ascending: true })
  if (error) throw error
  return data
}

export async function createSubject(input: SubjectInput) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subjects')
    .insert({ ...input, track_attendance: input.track_attendance ?? true })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateSubject(id: string, input: SubjectInput) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.from('subjects').update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data
}
