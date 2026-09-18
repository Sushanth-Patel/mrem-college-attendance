'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Recipient = {
  studentId: string
  rollNo: string
  fullName: string
  email: string | null
  overallPct: number | null
  lowestSubjectPct: number | null
  belowOverall: boolean
  belowSubject: boolean
}

type Batch = {
  batchId: string
  threshold: number
  sectionId: string | null
  total: number
  sent: number
  remaining: number
  triggeredAt: string
  triggeredBy: string
}

type SendResult = { rollNo: string; email: string | null; ok: boolean; note?: string }

export type SectionOption = { id: string; label: string }

const BATCH_SIZE = 5
// Gap between "send next 5" calls. Resend's free tier allows 2/sec and the
// per-email throttle already enforces 600ms, so this is about keeping the
// progress bar legible rather than about the rate limit itself.
const PAUSE_MS = 900

export default function AlertsConsole({ sections }: { sections: SectionOption[] }) {
  const [threshold, setThreshold] = useState(75)
  const [sectionId, setSectionId] = useState('')

  const [preview, setPreview] = useState<{ recipients: Recipient[]; evaluated: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [batches, setBatches] = useState<Batch[]>([])
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null)

  const [sending, setSending] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [log, setLog] = useState<SendResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // A ref, not state: the send loop reads it between iterations and must see
  // the current value, not the value captured when the loop started.
  const stopRequested = useRef(false)

  const loadBatches = useCallback(async () => {
    const res = await fetch('/api/admin/alerts')
    const data = await res.json()
    if (data.batches) setBatches(data.batches)
  }, [])

  useEffect(() => {
    loadBatches().catch(() => setError('Could not load alert history'))
  }, [loadBatches])

  const runPreview = async () => {
    setPreviewLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ preview: '1', threshold: String(threshold) })
      if (sectionId) params.set('sectionId', sectionId)
      const res = await fetch(`/api/admin/alerts?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreview({ recipients: data.recipients ?? [], evaluated: data.evaluated ?? 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const triggerBatch = async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_batch', threshold, sectionId: sectionId || null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.batchId) {
        setError(`No student is below ${threshold}% right now — nothing to queue.`)
        return
      }
      await loadBatches()
      const progress = await fetch(`/api/admin/alerts?batchId=${data.batchId}`).then((r) => r.json())
      setActiveBatch({
        ...progress.progress,
        sectionId: sectionId || null,
        triggeredBy: 'you',
      })
      setLog([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create batch')
    }
  }

  /**
   * Drive the send from the browser, five at a time (PRD §6.4). Closing the tab
   * just stops the loop — every delivered alert is already stamped server-side,
   * so reopening the batch resumes from the first unsent recipient.
   */
  const runSend = async (batch: Batch) => {
    stopRequested.current = false
    setSending(true)
    setError(null)
    let current = batch

    try {
      while (current.remaining > 0 && !stopRequested.current) {
        const res = await fetch('/api/admin/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_next',
            batchId: current.batchId,
            count: BATCH_SIZE,
            dryRun,
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        setLog((prev) => [...prev, ...(data.results ?? [])])
        current = { ...current, sent: current.total - data.remaining, remaining: data.remaining }
        setActiveBatch(current)

        if (data.sent === 0 && data.failed === 0) break
        if (current.remaining > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
      }
      await loadBatches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send interrupted — reopen the batch to resume')
    } finally {
      setSending(false)
    }
  }

  const resumeBatch = async (batch: Batch) => {
    setActiveBatch(batch)
    setLog([])
    await runSend(batch)
  }

  const pct = activeBatch && activeBatch.total > 0
    ? Math.round((activeBatch.sent / activeBatch.total) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Low-Attendance Alerts</h1>
        <p className="text-xs text-gray-500 mt-1">
          Review students falling below the mandatory threshold, preview communications, and dispatch batch
          notifications to students and registered parent contacts.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---------- Step 1: choose the population ---------- */}
      <section className="card-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="badge-violet">Step 1</span>
          <h2 className="text-sm font-bold text-gray-900">Who is below the threshold?</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Threshold (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="input-clean"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="input-clean"
            >
              <option value="">All active sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={runPreview} disabled={previewLoading} className="btn-secondary disabled:opacity-50">
            {previewLoading ? 'Checking…' : 'Preview recipients'}
          </button>
          <button
            onClick={triggerBatch}
            disabled={!preview || preview.recipients.length === 0}
            className="btn-primary disabled:opacity-40"
          >
            Queue batch{preview ? ` (${preview.recipients.length})` : ''}
          </button>
        </div>

        {preview && (
          <div className="pt-2">
            <p className="text-xs text-gray-500 mb-3">
              <span className="font-semibold text-gray-900">{preview.recipients.length}</span> of{' '}
              {preview.evaluated} active students are below {threshold}% overall or in at least one
              subject. Students with no periods held yet are excluded.
            </p>
            {preview.recipients.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Roll No</th>
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Email</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Overall</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Lowest subject</th>
                      <th className="px-4 py-2.5 font-semibold">Trigger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {preview.recipients.map((recipient) => (
                      <tr key={recipient.studentId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-gray-900">
                          {recipient.rollNo}
                        </td>
                        <td className="px-4 py-2.5">{recipient.fullName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{recipient.email ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                          {recipient.overallPct === null ? 'N/A' : `${recipient.overallPct}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {recipient.lowestSubjectPct === null ? 'N/A' : `${recipient.lowestSubjectPct}%`}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="badge-amber">
                            {recipient.belowOverall && recipient.belowSubject
                              ? 'overall + subject'
                              : recipient.belowOverall
                                ? 'overall'
                                : 'subject'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- Step 2: drive the send ---------- */}
      {activeBatch && (
        <section className="card-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="badge-violet">Step 2</span>
            <h2 className="text-sm font-bold text-gray-900">Sending alerts</h2>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1.5">
              <span>
                {activeBatch.sent} of {activeBatch.total} processed
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={sending}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold text-gray-900">Simulation mode</span> — build every email
              and advance the queue without dispatching anything. Uncheck to actually email students.
            </span>
          </label>

          {!dryRun && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Live sending is on. {activeBatch.remaining} real email
              {activeBatch.remaining === 1 ? '' : 's'} will be delivered to student inboxes.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => runSend(activeBatch)}
              disabled={sending || activeBatch.remaining === 0}
              className="btn-primary disabled:opacity-40"
            >
              {sending
                ? 'Sending…'
                : activeBatch.remaining === 0
                  ? 'Batch complete'
                  : dryRun
                    ? `Simulate ${activeBatch.remaining} remaining`
                    : `Send ${activeBatch.remaining} remaining`}
            </button>
            {sending && (
              <button
                onClick={() => {
                  stopRequested.current = true
                }}
                className="btn-secondary"
              >
                Pause
              </button>
            )}
          </div>

          {log.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {log.map((entry, index) => (
                <div key={`${entry.rollNo}-${index}`} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="font-mono font-semibold text-gray-900">{entry.rollNo}</span>
                  <span className="text-gray-500 truncate px-3">{entry.email ?? '—'}</span>
                  <span className={entry.ok ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {entry.ok ? entry.note ?? 'sent' : entry.note ?? 'failed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- Batch history / resume ---------- */}
      <section className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Alert batches ({batches.length})</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Any batch with alerts still pending can be resumed — including on a later day, which is how
            a batch larger than the 100/day cap completes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Triggered</th>
                <th className="px-6 py-3 font-semibold">By</th>
                <th className="px-6 py-3 font-semibold text-right">Threshold</th>
                <th className="px-6 py-3 font-semibold text-right">Sent / Total</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No alert batches yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.batchId} className="hover:bg-gray-50">
                    <td className="px-6 py-3">{new Date(batch.triggeredAt).toLocaleString()}</td>
                    <td className="px-6 py-3">{batch.triggeredBy}</td>
                    <td className="px-6 py-3 text-right font-semibold">{batch.threshold}%</td>
                    <td className="px-6 py-3 text-right font-mono">
                      {batch.sent} / {batch.total}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {batch.remaining > 0 ? (
                        <button
                          onClick={() => resumeBatch(batch)}
                          disabled={sending}
                          className="text-violet-700 font-semibold hover:underline disabled:opacity-40"
                        >
                          Resume ({batch.remaining})
                        </button>
                      ) : (
                        <span className="badge-green">complete</span>
                      )}
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
