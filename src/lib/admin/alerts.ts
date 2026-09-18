import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { sendEmail, buildAlertEmailHtml } from '@/lib/email/resend'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

export const DEFAULT_THRESHOLD = 75

export type AlertRecipient = {
  studentId: string
  rollNo: string
  fullName: string
  email: string | null
  overallPct: number | null
  lowestSubjectPct: number | null
  belowOverall: boolean
  belowSubject: boolean
}

type StudentRow = {
  id: string
  roll_no: string
  section_id: string
  profiles: { full_name: string; email: string } | null
}

/**
 * Resolve who is currently below the threshold, either on their aggregate or on
 * any single subject (PRD §6.4 — "overall or subject-wise"). Students with no
 * held periods yet are never included: an empty denominator means "no classes
 * held for them", not "0%" (PRD §6.3 day-one safeguard).
 *
 * Shared by the preview and by batch creation, so the list an admin approves is
 * computed exactly the same way as the list that gets queued.
 */
export async function previewAlertRecipients(args: {
  sectionId?: string | null
  threshold?: number
}): Promise<{ threshold: number; recipients: AlertRecipient[]; evaluated: number }> {
  await requireAdmin()
  const supabase = await createClient()
  const threshold = args.threshold ?? DEFAULT_THRESHOLD

  let studentQuery = supabase
    .from('students')
    .select('id, roll_no, section_id, profiles(full_name, email)')
    .eq('account_status', 'active')
    .order('roll_no')
  if (args.sectionId) studentQuery = studentQuery.eq('section_id', args.sectionId)

  const { data: studentRows, error: studentError } = await studentQuery
  if (studentError) throw studentError

  const students = (studentRows ?? []) as unknown as StudentRow[]
  if (students.length === 0) return { threshold, recipients: [], evaluated: 0 }

  const attendanceRows = await fetchStudentSubjectAttendance({
    studentIds: students.map((student) => student.id),
  })

  const byStudent = new Map<string, { held: number; attended: number; lowest: number | null }>()
  for (const row of attendanceRows) {
    const entry = byStudent.get(row.studentId) ?? { held: 0, attended: 0, lowest: null }
    entry.held += row.periodsHeld
    entry.attended += row.periodsAttended
    if (row.attendancePct !== null) {
      entry.lowest =
        entry.lowest === null ? row.attendancePct : Math.min(entry.lowest, row.attendancePct)
    }
    byStudent.set(row.studentId, entry)
  }

  const recipients: AlertRecipient[] = []
  for (const student of students) {
    const stats = byStudent.get(student.id)
    // No held periods → nothing to be below (PRD §6.3 day-one safeguard).
    if (!stats || stats.held === 0) continue

    const overallPct = Number(((stats.attended * 100) / stats.held).toFixed(2))
    const belowOverall = overallPct < threshold
    const belowSubject = stats.lowest !== null && stats.lowest < threshold
    if (!belowOverall && !belowSubject) continue

    recipients.push({
      studentId: student.id,
      rollNo: student.roll_no,
      fullName: student.profiles?.full_name ?? 'Unknown',
      email: student.profiles?.email ?? null,
      overallPct,
      lowestSubjectPct: stats.lowest,
      belowOverall,
      belowSubject,
    })
  }

  return { threshold, recipients, evaluated: students.length }
}

/**
 * Create an alert batch and populate alert_queue with everyone below the
 * threshold (PRD §6.4). Creating a batch sends nothing — the send is driven
 * afterwards by the admin console, a few at a time, and is resumable.
 */
export async function createAlertBatch(args: { sectionId?: string | null; threshold?: number }) {
  const admin = await requireAdmin()
  const supabase = await createClient()

  const { threshold, recipients } = await previewAlertRecipients(args)
  if (recipients.length === 0) {
    return { batchId: null, recipientCount: 0 }
  }

  const { data: batch, error: batchError } = await supabase
    .from('alert_batches')
    .insert({
      triggered_by: admin.id,
      threshold_used: threshold,
      section_id: args.sectionId ?? null,
      recipient_count: recipients.length,
    })
    .select('id')
    .single()

  if (batchError || !batch) throw batchError ?? new Error('Failed to create batch')

  const { error: queueError } = await supabase.from('alert_queue').insert(
    recipients.map((recipient) => ({
      batch_id: batch.id,
      student_id: recipient.studentId,
    }))
  )
  if (queueError) throw queueError

  const { error: auditError } = await supabase.from('audit_log').insert({
    performed_by: admin.id,
    action: 'alert_triggered',
    target_table: 'alert_batches',
    target_id: batch.id,
    old_value: null,
    new_value: {
      threshold_used: threshold,
      recipient_count: recipients.length,
      section_id: args.sectionId ?? null,
    },
  })
  if (auditError) throw auditError

  return { batchId: batch.id, recipientCount: recipients.length }
}

export async function getAlertBatchProgress(batchId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: batch, error: batchError } = await supabase
    .from('alert_batches')
    .select('id, threshold_used, section_id, recipient_count, triggered_at')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) throw batchError ?? new Error('Batch not found')

  const { count: sentCount, error: sentError } = await supabase
    .from('alert_queue')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .not('sent_at', 'is', null)

  if (sentError) throw sentError

  const sent = sentCount ?? 0
  return {
    batchId: batch.id,
    total: batch.recipient_count,
    sent,
    remaining: Math.max(0, batch.recipient_count - sent),
    threshold: Number(batch.threshold_used),
    triggeredAt: batch.triggered_at,
  }
}

/**
 * Batch history, newest first — this is what makes an interrupted send
 * resumable: any batch with remaining > 0 can be reopened and continued
 * (PRD §6.4). A batch of more than 100 recipients legitimately spans days.
 */
export async function listAlertBatches(limit = 20) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: batches, error } = await supabase
    .from('alert_batches')
    .select(
      'id, threshold_used, section_id, recipient_count, triggered_at, profiles:triggered_by(full_name)'
    )
    .order('triggered_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  if (!batches || batches.length === 0) return []

  const { data: sentRows, error: sentError } = await supabase
    .from('alert_queue')
    .select('batch_id, sent_at')
    .in(
      'batch_id',
      batches.map((batch) => batch.id)
    )
  if (sentError) throw sentError

  const sentByBatch = new Map<string, number>()
  for (const row of sentRows ?? []) {
    if (!row.sent_at) continue
    sentByBatch.set(row.batch_id, (sentByBatch.get(row.batch_id) ?? 0) + 1)
  }

  return batches.map((batch) => {
    const sent = sentByBatch.get(batch.id) ?? 0
    const triggeredBy = batch.profiles as unknown as { full_name: string } | null
    return {
      batchId: batch.id,
      threshold: Number(batch.threshold_used),
      sectionId: batch.section_id,
      total: batch.recipient_count,
      sent,
      remaining: Math.max(0, batch.recipient_count - sent),
      triggeredAt: batch.triggered_at,
      triggeredBy: triggeredBy?.full_name ?? 'Unknown',
    }
  })
}

/**
 * Send the next N unsent alerts in a batch (PRD §6.4). Deliberately small and
 * client-driven: a server-side blast would hit Vercel's free-tier execution
 * timeout, and Resend's free tier caps at 100/day, so the admin's open console
 * paces the send and every success is stamped individually — an interruption
 * resumes rather than restarts.
 *
 * dryRun builds each email and stamps the queue exactly as a real send would,
 * but dispatches nothing, so a batch can be rehearsed against real data before
 * any student inbox is touched.
 */
export async function sendNextAlerts(args: {
  batchId: string
  count?: number
  dryRun?: boolean
}) {
  await requireAdmin()
  const supabase = await createClient()
  const count = Math.min(Math.max(args.count ?? 5, 1), 25)

  const { data: batch, error: batchError } = await supabase
    .from('alert_batches')
    .select('threshold_used')
    .eq('id', args.batchId)
    .single()
  if (batchError || !batch) throw batchError ?? new Error('Alert batch not found')

  const { data: pending, error: pendingError } = await supabase
    .from('alert_queue')
    .select('id, student_id, students(id, roll_no, profiles(full_name, email))')
    .eq('batch_id', args.batchId)
    .is('sent_at', null)
    .limit(count)

  if (pendingError) throw pendingError
  if (!pending || pending.length === 0) {
    return { sent: 0, failed: 0, remaining: 0, dryRun: Boolean(args.dryRun), results: [] }
  }

  const threshold = Number(batch.threshold_used)
  const results: Array<{ rollNo: string; email: string | null; ok: boolean; note?: string }> = []
  let sentCount = 0
  let failedCount = 0

  for (const entry of pending) {
    const student = entry.students as unknown as {
      id: string
      roll_no: string
      profiles: { full_name: string; email: string } | null
    } | null

    if (!student?.profiles?.email) {
      failedCount++
      results.push({
        rollNo: student?.roll_no ?? 'unknown',
        email: null,
        ok: false,
        note: 'no email on file',
      })
      continue
    }

    const subjectRows = await fetchStudentSubjectAttendance({ studentId: entry.student_id })
    const subjectIds = subjectRows.map((row) => row.subjectId)
    const subjectNames = new Map<string, string>()
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)
      for (const subject of subjects ?? []) subjectNames.set(subject.id, subject.name)
    }

    const subjects = subjectRows.map((row) => ({
      name: subjectNames.get(row.subjectId) ?? 'Unknown',
      pct: row.attendancePct,
    }))
    const totalHeld = subjectRows.reduce((sum, row) => sum + row.periodsHeld, 0)
    const totalAttended = subjectRows.reduce((sum, row) => sum + row.periodsAttended, 0)
    const overallPct = totalHeld > 0 ? Number(((totalAttended * 100) / totalHeld).toFixed(2)) : null

    try {
      const html = buildAlertEmailHtml({
        studentName: student.profiles.full_name,
        overallPct,
        subjects,
        threshold,
      })

      if (!args.dryRun) {
        const sendResult = await sendEmail({
          to: student.profiles.email,
          subject: 'Low Attendance Alert — Action Required',
          html,
        })
        if ((sendResult as { suppressedByQuota?: boolean })?.suppressedByQuota) {
          results.push({
            rollNo: student.roll_no,
            email: student.profiles.email,
            ok: false,
            note: 'Paused by Free Tier Guard (daily cap reached)',
          })
          failedCount++
          continue
        }
      }

      const { error: stampError } = await supabase
        .from('alert_queue')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', entry.id)
      if (stampError) throw stampError

      sentCount++
      results.push({
        rollNo: student.roll_no,
        email: student.profiles.email,
        ok: true,
        note: args.dryRun ? 'simulated' : undefined,
      })
    } catch (error) {
      failedCount++
      console.error('Alert delivery failed', { batchId: args.batchId, queueId: entry.id, error })
      results.push({
        rollNo: student.roll_no,
        email: student.profiles.email,
        ok: false,
        note: error instanceof Error ? error.message : 'delivery failed',
      })
    }
  }

  const { count: remaining } = await supabase
    .from('alert_queue')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', args.batchId)
    .is('sent_at', null)

  return {
    sent: sentCount,
    failed: failedCount,
    remaining: remaining ?? 0,
    dryRun: Boolean(args.dryRun),
    results,
  }
}
