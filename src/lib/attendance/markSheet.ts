/**
 * Pure decision logic for the faculty attendance marking flow.
 * No database access — every function here is deterministic and unit-testable.
 * The DB-touching layer (marking.ts) calls these to decide WHAT to write;
 * this module decides what is ALLOWED and what CHANGED.
 */

import type { AttendanceStatus } from '@/lib/attendance/types'

export type { AttendanceStatus }

export const VALID_ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'absent',
]

export type ExistingRecord = {
  studentId: string
  status: AttendanceStatus
  markedByName: string | null
}

export type IncomingRecord = {
  studentId: string
  status: string
}

export type MarkingConflict = {
  markedByName: string
  markedAt: string | null
  isAdmin: boolean
}

/**
 * Detect whether saving `incoming` would overwrite records another user wrote.
 *
 * A conflict exists when ANY existing record for the session was marked by a
 * different named user than the current marker (compare against markerName,
 * or against `admin`/`faculty` sentinels when only the role is known).
 * The caller turns a non-null result into a 409 + confirm modal; PRD §6.9
 * forbids silently saving over someone else's submission.
 */
export function detectMarkingConflict(args: {
  existing: ExistingRecord[]
  incoming: IncomingRecord[]
  currentMarkerName: string | null
  currentMarkerIsAdmin: boolean
}): MarkingConflict | null {
  if (args.currentMarkerIsAdmin) {
    // Admin overrides are authorized corrections (PRD §6.5/§6.7) — they still
    // audit-log the overwrite, but no confirmation gate applies.
    return null
  }

  const incomingIds = new Set(args.incoming.map((r) => r.studentId))
  for (const record of args.existing) {
    if (!incomingIds.has(record.studentId)) continue
    const other = record.markedByName
    if (!other) continue
    if (other === 'admin' || other === 'faculty') {
      // Role-only attribution (legacy rows / admin marks without a profile name)
      if (other === 'admin') return { markedByName: 'an Administrator', markedAt: null, isAdmin: true }
      continue // another faculty's name is unknown here — treat as no named conflict
    }
    if (other !== args.currentMarkerName) {
      return { markedByName: other, markedAt: null, isAdmin: false }
    }
  }
  return null
}

/**
 * Compute the minimal write set: only rows that are NEW or whose status
 * actually differs from the stored value. Sending the full sheet must never
 * re-attribute unchanged rows to the current user (scenario #6: two staff
 * members cooperating on one sheet must not erase each other's audit trail
 * on rows they did not touch).
 */
export function computeRecordDiff(args: {
  existing: ExistingRecord[]
  incoming: IncomingRecord[]
}): Array<{ studentId: string; status: AttendanceStatus; previous: AttendanceStatus | null }> {
  const existingByStudent = new Map(args.existing.map((r) => [r.studentId, r]))
  const diff: Array<{ studentId: string; status: AttendanceStatus; previous: AttendanceStatus | null }> = []
  for (const record of args.incoming) {
    const status = record.status as AttendanceStatus
    if (!VALID_ATTENDANCE_STATUSES.includes(status)) continue
    const prior = existingByStudent.get(record.studentId)
    if (!prior || prior.status !== status) {
      diff.push({ studentId: record.studentId, status, previous: prior?.status ?? null })
    }
  }
  return diff
}

/**
 * Validate the marking payload shape before any DB access.
 * Returns a human-readable error string, or null when valid.
 */
export function validateMarkingPayload(records: unknown): records is IncomingRecord[] {
  if (!Array.isArray(records) || records.length === 0) return false
  const seen = new Set<string>()
  for (const entry of records) {
    const rec = entry as { studentId?: unknown; status?: unknown }
    if (typeof rec.studentId !== 'string' || rec.studentId.length === 0) return false
    if (typeof rec.status !== 'string') return false
    if (!VALID_ATTENDANCE_STATUSES.includes(rec.status as AttendanceStatus)) return false
    if (seen.has(rec.studentId)) return false
    seen.add(rec.studentId)
  }
  return true
}

/**
 * PRD §6.3 percentage math. Excused is stored and displayed as a distinct
 * status but counts the same as absent: it sits in the denominator, never
 * the numerator. periods_held = 0 → null; the UI renders null as "N/A"
 * (the day-one safeguard — a student must never show 0% before any class).
 */
export function attendancePercentage(args: {
  present: number
  absent: number
  excused: number
}): number | null {
  const held = args.present + args.absent + args.excused
  if (held === 0) return null
  return Number(((args.present / held) * 100).toFixed(2))
}
