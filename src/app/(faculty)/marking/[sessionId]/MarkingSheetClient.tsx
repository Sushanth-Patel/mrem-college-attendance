'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Reveal } from '@/components/motion'
import type { AttendanceStatus } from '@/lib/attendance/types'

type StudentRow = {
  id: string
  rollNo: string
  fullName: string
  accountStatus: string
  attendanceFlag: string
  locked: boolean
  status: AttendanceStatus | null
}

type OverwriteWarning = {
  markerName: string
  markedAt: string | null
  isAdmin: boolean
} | null

type MarkingSheetData = {
  sessionId: string
  sessionDate: string
  sessionStatus: string
  detainedCount?: number
  overwriteWarning: OverwriteWarning
  students: StudentRow[]
}

type ConflictDetails = {
  markedByName: string
  markedAt: string | null
  isAdmin: boolean
}

type Props = {
  sessionId: string
  initialData: MarkingSheetData
  isLabBlock: boolean
  blockCount: number
}

export default function MarkingSheetClient({
  sessionId,
  initialData,
  isLabBlock,
  blockCount,
}: Props) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {}
    for (const st of initialData.students) {
      if (st.status) {
        map[st.id] = st.status
      } else if (st.accountStatus === 'active') {
        map[st.id] = st.attendanceFlag === 'irregular' ? 'absent' : 'present'
      }
    }
    return map
  })

  const [applyToBlock, setApplyToBlock] = useState(isLabBlock)
  const [showOverwriteModal, setShowOverwriteModal] = useState(false)
  const [conflict, setConflict] = useState<ConflictDetails | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all')
  const [reason, setReason] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const markableStudents = useMemo(
    () => initialData.students.filter((s) => s.accountStatus === 'active'),
    [initialData.students]
  )

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }))
    setHasChanges(true)
  }

  const markAll = (status: AttendanceStatus) => {
    setAttendance((prev) => {
      const next = { ...prev }
      for (const st of initialData.students) {
        if (!st.locked) {
          next[st.id] = status
        }
      }
      return next
    })
    setHasChanges(true)
  }

  /**
   * PRD §6.9: the server is the single source of truth for the overwrite gate.
   * The first attempt always submits with overwriteConfirmed = false; a 409
   * response carrying conflict details opens the confirm modal showing WHO
   * submitted previously. Confirming re-submits with the flag set.
   */
  const submit = async (overwriteConfirmed: boolean) => {
    if (markableStudents.length === 0) {
      setErrorMessage('There are no active students to mark in this session.')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    // Full-sheet submission: every active student's current status is sent.
    // The server diffs against stored records and writes only what changed.
    const records = markableStudents.map((student) => ({
      studentId: student.id,
      status: attendance[student.id] ?? 'absent',
    }))

    try {
      const endpoint = applyToBlock ? '/api/attendance/block-mark' : '/api/attendance/mark'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          records,
          overwriteConfirmed,
          reason: reason.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.conflict && !overwriteConfirmed) {
        setConflict(data.conflict as ConflictDetails)
        setShowOverwriteModal(true)
        return
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save attendance')
      }

      const changed = typeof data.changed === 'number' ? data.changed : records.length
      setSuccessMessage(
        applyToBlock
          ? `✓ Saved across ${blockCount} period${blockCount > 1 ? 's' : ''} of the lab block — ${changed} record change${changed === 1 ? '' : 's'} written and audit-logged.`
          : `✓ Attendance submitted — ${changed} record change${changed === 1 ? '' : 's'} written and audit-logged.`
      )
      setShowOverwriteModal(false)
      setConflict(null)
      setHasChanges(false)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting attendance')
    } finally {
      setSaving(false)
    }
  }

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length
  const absentCount = Object.values(attendance).filter((s) => s === 'absent').length
  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return initialData.students.filter((student) => {
      const matchesSearch =
        !query ||
        student.rollNo.toLowerCase().includes(query) ||
        student.fullName.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || attendance[student.id] === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [attendance, initialData.students, search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Reveal from="up" distance={18}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/today" className="text-xs text-blue-600 hover:underline">
              &larr; Back to Schedule
            </Link>
            <span className="text-gray-700">•</span>
            <span className="text-xs text-gray-500 font-mono">Date: {initialData.sessionDate}</span>
            {initialData.sessionStatus === 'cancelled' && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
                Cancelled
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Period Attendance Marking Sheet
          </h1>
          <p className="text-[11px] text-gray-500 mt-1">
            Editable today and tomorrow (IST). Later corrections require an Admin unlock.
          </p>
        </div>

        {/* Quick Batch Selectors */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => markAll('present')}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition shadow-sm"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll('absent')}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition shadow-sm"
          >
            Mark All Absent
          </button>
        </div>
        </div>
      </Reveal>

      {/* Overwrite Warning Banner — informational */}
      {initialData.overwriteWarning && (
        <Reveal from="scale" distance={0}>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-xs">
              <p className="font-bold text-amber-900">
                Attendance already submitted by {initialData.overwriteWarning.markerName}
                {initialData.overwriteWarning.markedAt ? ` at ${initialData.overwriteWarning.markedAt}` : ''}.
              </p>
              <p className="mt-0.5 text-amber-700">
                Saving modifications will be confirmed explicitly and recorded in the audit trail.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-500/40 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-500/40 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lab Block Multi-Period Option (PRD §6.8) */}
      {isLabBlock && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              {blockCount}P
            </div>
            <div>
              <p className="font-bold text-xs text-gray-900">Multi-Period Lab Block Detected</p>
              <p className="text-[11px] text-indigo-300/80">
                Single-tap simultaneously applies your marks across all {blockCount} consecutive periods.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-900 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={applyToBlock}
              onChange={(e) => setApplyToBlock(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Single-Tap Full Block</span>
          </label>
        </div>
      )}

      {/* Student List Table */}
      <Reveal from="up" distance={24} delay={0.08}>
      <div className="card-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-gray-900">
              Active Enrolled Students ({initialData.students.length})
            </span>
            {initialData.detainedCount !== undefined && initialData.detainedCount > 0 && (
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>⚠</span>
                <span>{initialData.detainedCount} Detained Excluded</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Present: {presentCount} ({markableStudents.length > 0 ? ((presentCount * 100) / markableStudents.length).toFixed(0) : 0}%)
            </span>
            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              Absent: {absentCount}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-4 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Search students</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by roll number or name"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </label>
          <label>
            <span className="sr-only">Filter students by attendance status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | AttendanceStatus)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-400 focus:outline-none sm:w-40"
            >
              <option value="all">All statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Roll Number</th>
                <th className="px-6 py-3 font-semibold">Student Full Name</th>
                <th className="px-6 py-3 font-semibold text-center w-72">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {visibleStudents.map((student) => {
                const currentStatus = attendance[student.id]

                return (
                  <tr
                    key={student.id}
                    className={`transition ${
                      student.locked
                        ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-3 font-mono font-bold text-gray-900">
                      {student.rollNo}
                      {student.attendanceFlag === 'irregular' && (
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-sans">
                          Irregular
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3 font-medium">
                      {student.fullName}
                      {student.locked && (
                        <span className="ml-2 text-[10px] text-rose-600 font-normal">
                          (Detained — Locked)
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3">
                      {student.locked ? (
                        <span className="text-center block text-[11px] text-gray-500 font-mono">
                          LOCKED • UN-TICKABLE
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Mark ${student.fullName} present`}
                            onClick={() => handleStatusChange(student.id, 'present')}
                            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-xs transition ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            P
                          </button>

                          <button
                            type="button"
                            aria-label={`Mark ${student.fullName} absent`}
                            onClick={() => handleStatusChange(student.id, 'absent')}
                            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-xs transition ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            A
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visibleStudents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No students match the current search or status filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </Reveal>

      {/* Floating Action Submit Bar — Glassmorphism Light */}
      <div className="sticky bottom-4 z-40 glass-panel border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="text-xs text-gray-600">
          Recorded: <strong className="text-gray-900 font-mono">{presentCount + absentCount}</strong> of <strong className="text-gray-900 font-mono">{markableStudents.length}</strong> active students
          {hasChanges && <span className="ml-2 text-amber-600 font-semibold">• Unsaved modifications</span>}
        </div>

        <button
          type="button"
          onClick={() => submit(false)}
          disabled={saving || markableStudents.length === 0}
          className="btn-primary text-xs py-2.5 px-6 rounded-xl shadow-md flex items-center justify-center gap-2"
        >
          {saving ? (
            <span>Saving Attendance...</span>
          ) : (
            <span>Save &amp; Submit Attendance</span>
          )}
        </button>
      </div>

      {/* Overwrite Confirmation Modal (PRD §6.9) — details come from the server's 409 */}
      {showOverwriteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full shadow-card">
            <h3 className="text-base font-bold text-gray-900 mb-2">Confirm Attendance Overwrite</h3>
            <p className="text-xs text-gray-600 mb-4">
              Attendance records already exist for this session
              {conflict?.markedByName ? `, submitted by ${conflict.markedByName}` : ''}
              {conflict?.markedAt ? ` at ${conflict.markedAt}` : ''}.
              {' '}Overwriting them will be permanently logged with your user credentials in the audit trail.
            </p>
            <label className="block mb-5">
              <span className="mb-1 block text-xs font-semibold text-gray-700">Reason for overwrite</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why these attendance records are being corrected"
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-rose-400 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowOverwriteModal(false)
                  setConflict(null)
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-100 text-gray-900 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={saving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                {saving ? 'Saving…' : 'Confirm Overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
