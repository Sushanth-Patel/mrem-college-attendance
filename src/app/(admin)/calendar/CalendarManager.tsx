'use client'

import { useCallback, useEffect, useState } from 'react'

type SessionRow = {
  id: string
  periodNumber: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'holiday'
  isAdminMarked: boolean
  sectionId: string
  sectionLabel: string
  subjectCode: string
  subjectName: string
  markedCount: number
}

export type SectionOption = { id: string; label: string }

const STATUS_STYLE: Record<SessionRow['status'], string> = {
  scheduled: 'badge-gray',
  completed: 'badge-green',
  cancelled: 'badge-amber',
  holiday: 'badge-red',
}

const STATUS_LABEL: Record<SessionRow['status'], string> = {
  scheduled: 'not yet marked',
  completed: 'marked',
  cancelled: 'cancelled',
  holiday: 'holiday',
}

function todayInIST() {
  // The session calendar is an IST artifact (PRD §6.5) — deriving "today" from
  // the browser's own clock would show the wrong day to anyone outside India.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export default function CalendarManager({ sections }: { sections: SectionOption[] }) {
  const [date, setDate] = useState(todayInIST)
  const [sectionId, setSectionId] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date })
      if (sectionId) params.set('sectionId', sectionId)
      const res = await fetch(`/api/admin/sessions?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSessions(data.sessions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [date, sectionId])

  useEffect(() => {
    load()
  }, [load])

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data
  }

  const setOne = async (session: SessionRow, status: SessionRow['status']) => {
    setBusyId(session.id)
    setError(null)
    setNotice(null)
    try {
      await post({ action: 'set_status', sessionId: session.id, status, reason: reason || undefined })
      setNotice(`Period ${session.periodNumber} (${session.subjectCode}) set to ${STATUS_LABEL[status]}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const setWholeDay = async (status: 'holiday' | 'cancelled' | 'scheduled') => {
    setBusyId('bulk')
    setError(null)
    setNotice(null)
    try {
      const data = await post({
        action: 'set_status_for_date',
        date,
        status,
        sectionId: sectionId || null,
        reason: reason || undefined,
      })
      setNotice(
        data.changed === 0
          ? 'Nothing to change — every session on this date already has that status.'
          : `${data.changed} session${data.changed === 1 ? '' : 's'} set to ${STATUS_LABEL[status]}.`
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setBusyId(null)
    }
  }

  const markedTotal = sessions.reduce((sum, session) => sum + session.markedCount, 0)
  const nonHeld = sessions.filter((s) => s.status === 'cancelled' || s.status === 'holiday').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Session Calendar & Holidays</h1>
        <p className="text-xs text-gray-500 mt-1">
          Declare a holiday or cancel individual periods — including retroactively, after a day has
          already been marked (PRD §5.4). Nothing is deleted: cancelled and holiday sessions simply
          drop out of every student&apos;s denominator, and re-opening the day restores them intact.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <section className="card-surface p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-clean"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input-clean">
              <option value="">All sections (college-wide closure)</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Reason <span className="font-normal text-gray-400">(recorded in the audit trail)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Unscheduled closure — heavy rainfall"
            className="input-clean"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={() => setWholeDay('holiday')}
            disabled={busyId !== null || sessions.length === 0}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-40"
          >
            Declare whole day a holiday
          </button>
          <button
            onClick={() => setWholeDay('cancelled')}
            disabled={busyId !== null || sessions.length === 0}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-40"
          >
            Cancel all classes
          </button>
          <button
            onClick={() => setWholeDay('scheduled')}
            disabled={busyId !== null || nonHeld === 0}
            className="btn-secondary disabled:opacity-40"
          >
            Re-open the day
          </button>
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Sessions on {date} ({sessions.length})
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {markedTotal} attendance record{markedTotal === 1 ? '' : 's'} on this date
              {nonHeld > 0 ? ` · ${nonHeld} not counted toward attendance` : ''}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="btn-ghost text-xs disabled:opacity-40">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Period</th>
                <th className="px-6 py-3 font-semibold">Section</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold text-right">Records</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Set to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {loading
                      ? 'Loading sessions…'
                      : 'No sessions exist for this date yet. Sessions are created when faculty open their schedule or a marking sheet for that day.'}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono font-semibold text-gray-900">
                      P{session.periodNumber}
                    </td>
                    <td className="px-6 py-3">{session.sectionLabel}</td>
                    <td className="px-6 py-3">
                      <span className="font-mono font-semibold text-violet-700">{session.subjectCode}</span>
                      <span className="text-gray-500"> · {session.subjectName}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{session.markedCount}</td>
                    <td className="px-6 py-3">
                      <span className={STATUS_STYLE[session.status]}>{STATUS_LABEL[session.status]}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {(['holiday', 'cancelled', 'scheduled'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => setOne(session, status)}
                            disabled={busyId !== null || session.status === status}
                            className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition"
                          >
                            {status === 'scheduled' ? 'open' : status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
