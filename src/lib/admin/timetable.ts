import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

type TimetableEntryInput = {
  section_id: string
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  period_slot_id: string
  section_subject_id: string | null
  room: string | null
}

export async function listTimetableBySection(sectionId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('timetable_entries')
    .select(
      '*, period_slots(period_number, start_time, end_time, label), section_subjects(id, subject_id, default_faculty_id)'
    )
    .eq('section_id', sectionId)
    .order('day_of_week')

  if (error) throw error
  return data
}

export async function upsertTimetableEntries(entries: TimetableEntryInput[]) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('timetable_entries')
    .upsert(entries, { onConflict: 'section_id,day_of_week,period_slot_id' })
    .select('*')

  if (error) throw error
  return data
}
