import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

type AuditLogInput = {
  attendanceRecordId?: string
  studentId?: string
  fieldChanged: string
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
}

export async function logAudit(input: AuditLogInput) {
  if (!input.attendanceRecordId && !input.studentId) {
    throw new Error('Either attendanceRecordId or studentId is required for audit logging')
  }

  const supabase = await createClient()
  const user = await getCurrentUser()

  const { error } = await supabase.from('audit_log').insert({
    performed_by: user.id,
    action: input.oldValue === null ? 'attendance_marked' : 'attendance_edited',
    target_table: 'attendance_records',
    target_id: input.attendanceRecordId ?? input.studentId ?? null,
    old_value: input.oldValue === null ? null : { [input.fieldChanged]: input.oldValue },
    new_value: {
      [input.fieldChanged]: input.newValue ?? null,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  })

  if (error) {
    throw error
  }
}
