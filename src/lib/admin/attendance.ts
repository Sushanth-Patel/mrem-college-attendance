import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import type { AttendanceStatus, StudentAccountStatus } from '@/lib/attendance/types'

/**
 * Admin/HoD direct marking (PRD §6.7) — for genuine coverage gaps.
 * Runs against the live schema: admin coverage is recorded on the session row
 * (is_admin_marked) and every change is appended to audit_log. marked_by_role
 * attribution on individual records arrives with the §8 migration.
 */
export async function adminDirectMarkAttendance(args: {
  sessionId: string
  studentId: string
  status: AttendanceStatus
  reason: string
}) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, section_id, status, is_admin_marked, marked_at')
    .eq('id', args.sessionId)
    .single()
  if (sessionError || !session) throw sessionError ?? new Error('Session not found')

  // A holiday is as un-held as a cancellation (PRD §5.4) — neither can carry
  // attendance, including via the admin direct-marking path.
  if (session.status === 'cancelled' || session.status === 'holiday') {
    throw new Error(`This session is ${session.status} — attendance marking is disabled`)
  }

  // Roster validation: the student must be an active member of this section.
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, account_status')
    .eq('id', args.studentId)
    .eq('section_id', session.section_id)
    .maybeSingle()
  if (studentError) throw studentError
  if (!student) throw new Error('Student does not belong to this session\'s section')
  if (student.account_status !== 'active') {
    throw new Error(`Student is ${student.account_status} and cannot be marked`)
  }

  const { data: existing, error: existingError } = await supabase
    .from('attendance_records')
    .select('id, status')
    .eq('session_id', args.sessionId)
    .eq('student_id', args.studentId)
    .maybeSingle()
  if (existingError) throw existingError

  // Attribute the session to admin coverage (PRD §6.7 display treatment).
  const { error: sessionUpdateError } = await supabase
    .from('sessions')
    .update({ is_admin_marked: true, marked_at: session.marked_at ?? new Date().toISOString() })
    .eq('id', args.sessionId)
  if (sessionUpdateError) throw sessionUpdateError

  if (existing) {
    if (existing.status === args.status) return
    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({ status: args.status })
      .eq('id', existing.id)
    if (updateError) throw updateError

    await logAdminAttendanceChange({
      adminId: admin.id,
      attendanceRecordId: existing.id,
      studentId: args.studentId,
      oldValue: existing.status,
      newValue: args.status,
      reason: args.reason,
    })
    return
  }

  const { data: inserted, error: insertError } = await supabase
    .from('attendance_records')
    .insert({
      session_id: args.sessionId,
      student_id: args.studentId,
      status: args.status,
    })
    .select('id')
    .single()
  if (insertError || !inserted) throw insertError ?? new Error('Insert failed')

  await logAdminAttendanceChange({
    adminId: admin.id,
    attendanceRecordId: inserted.id,
    studentId: args.studentId,
    oldValue: null,
    newValue: args.status,
    reason: args.reason,
  })
}

async function logAdminAttendanceChange(args: {
  adminId: string
  attendanceRecordId: string
  studentId: string
  oldValue: string | null
  newValue: string
  reason: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('audit_log').insert({
    performed_by: args.adminId,
    action: args.oldValue === null ? 'attendance_marked' : 'attendance_edited',
    target_table: 'attendance_records',
    target_id: args.attendanceRecordId,
    old_value: args.oldValue === null ? null : { status: args.oldValue },
    new_value: { status: args.newValue, reason: args.reason, marked_by_role: 'admin' },
  })
  if (error) throw error
}

export async function adminSetStudentStatus(args: {
  studentId: string
  status: StudentAccountStatus
  reason: string
}) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('students')
    .select('id, account_status')
    .eq('id', args.studentId)
    .single()
  if (existingError || !existing) throw existingError ?? new Error('Student not found')

  if (existing.account_status === args.status) return

  const { error: updateError } = await supabase
    .from('students')
    .update({ account_status: args.status })
    .eq('id', args.studentId)
  if (updateError) throw updateError

  const { error: auditError } = await supabase.from('audit_log').insert({
    performed_by: admin.id,
    action: 'student_status_changed',
    target_table: 'students',
    target_id: args.studentId,
    old_value: { account_status: existing.account_status },
    new_value: { account_status: args.status, reason: args.reason },
  })
  if (auditError) throw auditError
}

export async function adminUpdateJoiningDate(args: { studentId: string; joiningDate: string; reason: string }) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('students')
    .select('id, joining_date')
    .eq('id', args.studentId)
    .single()
  if (existingError || !existing) throw existingError ?? new Error('Student not found')

  const { error: updateError } = await supabase
    .from('students')
    .update({ joining_date: args.joiningDate })
    .eq('id', args.studentId)
  if (updateError) throw updateError

  const { error: auditError } = await supabase.from('audit_log').insert({
    performed_by: admin.id,
    action: 'joining_date_changed',
    target_table: 'students',
    target_id: args.studentId,
    old_value: { joining_date: existing.joining_date },
    new_value: { joining_date: args.joiningDate, reason: args.reason },
  })
  if (auditError) throw auditError
}

/**
 * Admin unlock of a record beyond the faculty edit window (PRD §6.5).
 * The live schema tracks this via audit history; the admin_unlocked column
 * arrives with the §8 migration — until then the unlock event itself is
 * recorded in the audit trail.
 */
export async function adminUnlockAttendanceRecord(args: { attendanceRecordId: string; reason: string }) {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase
    .from('attendance_records')
    .select('id, status, student_id')
    .eq('id', args.attendanceRecordId)
    .single()
  if (existingError || !existing) throw existingError ?? new Error('Attendance record not found')

  const { error: auditError } = await supabase.from('audit_log').insert({
    performed_by: admin.id,
    action: 'admin_override',
    target_table: 'attendance_records',
    target_id: args.attendanceRecordId,
    old_value: { status: existing.status },
    new_value: { status: existing.status, admin_unlocked: true, reason: args.reason },
  })
  if (auditError) throw auditError
}
