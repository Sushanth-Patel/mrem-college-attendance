import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * List audit logs with filters (PRD §7.1).
 * Filterable by role, field, and date range (inclusive on both ends).
 */
export async function listAuditLogs(filters?: {
  changedByRole?: 'student' | 'faculty' | 'admin'
  fieldChanged?: string
  dateFrom?: string             // ISO date string (YYYY-MM-DD), inclusive
  dateTo?: string               // ISO date string (YYYY-MM-DD), inclusive
  limit?: number
}) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, target_table, target_id, old_value, new_value, performed_at, profiles:performed_by(full_name, email, role)')
    .eq('target_table', 'attendance_records')
    .order('performed_at', { ascending: false })
    .limit(filters?.limit ?? 200)
  if (error) throw error

  return (data ?? [])
    .map((log) => {
      const actor = log.profiles as unknown as { full_name: string; email: string; role: string } | null
      const oldValue = log.old_value as Record<string, unknown> | null
      const newValue = log.new_value as Record<string, unknown> | null
      // audit_log rows store the changed field inside the JSONB payload
      // ({ status, reason? }) — derive the field name from it instead of
      // assuming every entry is an attendance 'status' change.
      const fieldChanged =
        Object.keys(newValue ?? {}).find((key) => key !== 'reason') ??
        Object.keys(oldValue ?? {}).find((key) => key !== 'reason') ??
        'status'
      return {
        id: log.id,
        changed_at: log.performed_at,
        changed_by_role: actor?.role ?? null,
        field_changed: fieldChanged,
        old_value: oldValue?.[fieldChanged] == null ? null : String(oldValue[fieldChanged]),
        new_value: newValue?.[fieldChanged] == null ? null : String(newValue[fieldChanged]),
        reason: newValue?.reason == null ? null : String(newValue.reason),
        attendance_record_id: log.target_id,
        student_id: null,
        changer: actor,
        student: null,
      }
    })
    .filter((log) => {
      if (filters?.changedByRole && log.changed_by_role !== filters.changedByRole) return false
      if (filters?.fieldChanged && log.field_changed !== filters.fieldChanged) return false
      // ISO timestamps compare lexicographically against YYYY-MM-DD prefixes
      const day = typeof log.changed_at === 'string' ? log.changed_at.slice(0, 10) : ''
      if (filters?.dateFrom && (!day || day < filters.dateFrom)) return false
      if (filters?.dateTo && (!day || day > filters.dateTo)) return false
      return true
    })
}
