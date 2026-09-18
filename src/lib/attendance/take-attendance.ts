import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

export async function openOrCreateClassSession(args: {
  sectionId: string
  subjectId: string
  sessionDate: string
  periodNumber: number
}) {
  const user = await getCurrentUser()
  if (user.role !== 'faculty' && user.role !== 'admin') {
    throw new Error('Unauthorized to open class attendance sessions')
  }

  const supabase = await createClient()

  // 1. Check if session already exists for this section, date, and period
  const { data: existing, error: fetchError } = await supabase
    .from('sessions')
    .select('id, status, actual_faculty_id')
    .eq('section_id', args.sectionId)
    .eq('session_date', args.sessionDate)
    .eq('period_number', args.periodNumber)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (existing) {
    return { sessionId: existing.id, isNew: false }
  }

  // 2. Create new session
  const { data: newSession, error: insertError } = await supabase
    .from('sessions')
    .insert({
      section_id: args.sectionId,
      subject_id: args.subjectId,
      session_date: args.sessionDate,
      period_number: args.periodNumber,
      actual_faculty_id: user.id,
      status: 'scheduled',
    })
    .select('id')
    .single()

  if (insertError) throw insertError

  return { sessionId: newSession.id, isNew: true }
}
