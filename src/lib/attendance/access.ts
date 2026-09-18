import { createClient } from '@/lib/supabase/server'

export async function verifyFacultyAccess(facultyId: string, sectionSubjectId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('section_subjects')
    .select('default_faculty_id')
    .eq('id', sectionSubjectId)
    .single()

  if (error) {
    throw error
  }

  return data.default_faculty_id === facultyId
}
