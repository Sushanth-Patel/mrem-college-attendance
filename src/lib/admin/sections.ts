import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type SectionInput = {
  branch_id: string
  year_of_study: number
  semester: 'odd' | 'even'
  academic_year: string
  section_name: string
  term_start_date: string // ISO date string, default source for students.joining_date (PRD §3.1)
  is_active?: boolean
}

export type BulkSectionInput = {
  branch_id: string
  year_of_study: number
  semester: 'odd' | 'even'
  academic_year: string
  term_start_date: string
  count: number
  prefix?: string // e.g. "Section " or "" -> "A", "B", "C"...
}

export async function listSections() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sections')
    .select('*, branches(name, code)')
    .order('academic_year', { ascending: false })
    .order('year_of_study', { ascending: true })
    .order('section_name', { ascending: true })

  if (error) throw error
  return data
}

export async function createSection(input: SectionInput) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sections')
    .insert({ ...input, is_active: input.is_active ?? true })
    .select('*, branches(name, code)')
    .single()
  if (error) throw error
  return data
}

export async function createBulkSections(input: BulkSectionInput) {
  await requireAdmin()
  const supabase = await createClient()
  
  const sectionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const count = Math.min(Math.max(1, input.count), 26)
  
  const rows = []
  for (let i = 0; i < count; i++) {
    const secLetter = sectionLetters[i]
    const name = input.prefix ? `${input.prefix.trim()} ${secLetter}` : secLetter
    rows.push({
      branch_id: input.branch_id,
      year_of_study: input.year_of_study,
      semester: input.semester,
      academic_year: input.academic_year,
      section_name: name,
      term_start_date: input.term_start_date,
      is_active: true,
    })
  }

  const { data, error } = await supabase
    .from('sections')
    .upsert(rows, { onConflict: 'branch_id,year_of_study,semester,academic_year,section_name' })
    .select('*, branches(name, code)')

  if (error) throw error
  return data
}

export async function updateSection(id: string, input: Partial<SectionInput>) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sections')
    .update(input)
    .eq('id', id)
    .select('*, branches(name, code)')
    .single()
  if (error) throw error
  return data
}

export async function deleteSection(id: string) {
  await requireAdmin()
  const supabase = await createClient()
  
  // Clean up roster students and timetable entries for this section
  await supabase.from('roster_students').delete().eq('section_id', id)
  await supabase.from('timetable_entries').delete().eq('section_id', id)
  await supabase.from('section_subjects').delete().eq('section_id', id)

  const { error } = await supabase.from('sections').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function setSectionActiveState(id: string, isActive: boolean) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sections')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*, branches(name, code)')
    .single()
  if (error) throw error
  return data
}
