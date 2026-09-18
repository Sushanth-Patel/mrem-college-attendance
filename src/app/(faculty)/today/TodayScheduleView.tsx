'use client'

import Link from 'next/link'
import { Reveal, TiltCard } from '@/components/motion'

export type SessionCardSlot = {
  id: string | number
  periodNumber: number | string
  subjectCode: string
  subjectName: string
  startTime: string
  endTime: string
  room: string | null
  isLab: boolean
  status: string | null
  sessionId: string | null
  href: string | null
  state: 'markable' | 'non-academic' | 'error' | 'inactive'
  message: string | null
}

export type TodayScheduleViewProps = {
  formattedToday: string
  sessions: SessionCardSlot[]
}

const STATUS_CHIP: Record<string, { className: string; label: string }> = {
  completed: {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'marked',
  },
  cancelled: {
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'cancelled',
  },
  holiday: {
    className: 'bg-red-50 text-red-700 border-red-200',
    label: 'holiday',
  },
}

/**
 * Clean light presentation for Today's Schedule: card-based header,
 * staggered domino entrances, and a subtle tilt on session cards.
 * Purely presentational — all data logic stays in the server component.
 */
export default function TodayScheduleView({
  formattedToday,
  sessions,
}: TodayScheduleViewProps) {
  const totalSlots = sessions.length
  const markedSlots = sessions.filter((s) => s.status === 'completed').length
  const pendingSlots = sessions.filter((s) => s.state === 'markable' && s.status !== 'completed').length

  return (
    <div className="space-y-6">
      {/* Clean glass-panel header card */}
      <Reveal from="up" distance={18}>
        <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200/90 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold mb-2 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              Live Academic Day • Asia/Kolkata
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Today&apos;s Class Schedule
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{formattedToday}</p>
          </div>

          {/* Action Button & KPI Mini Strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/take-attendance"
              className="btn-primary text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <span>+ Take Class Attendance</span>
            </Link>

            <Link
              href="/attendance-history"
              className="btn-secondary text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <span>📋 Past Classes & Corrections</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[60px] shadow-sm">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Total</span>
                <span className="text-sm font-bold font-mono text-gray-900 leading-tight block">{totalSlots}</span>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-1.5 text-center min-w-[60px] shadow-sm">
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Marked</span>
                <span className="text-sm font-bold font-mono text-emerald-700 leading-tight block">{markedSlots}</span>
              </div>
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl px-3 py-1.5 text-center min-w-[60px] shadow-sm">
                <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider block">Pending</span>
                <span className="text-sm font-bold font-mono text-blue-700 leading-tight block">{pendingSlots}</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Schedule timeline: staggered domino entrances */}
      {sessions.length === 0 ? (
        <Reveal from="scale" distance={0}>
          <div className="card-surface p-12 text-center">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="font-semibold text-gray-900 text-sm">No timetable classes scheduled for you today.</p>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Need to cover a swapped class, proxy lecture, or lab session? Select any academic year, branch, and section to begin.
            </p>
            <div className="mt-4">
              <Link href="/take-attendance" className="btn-primary text-xs py-2 px-4 rounded-xl inline-block shadow-sm">
                Take Class Attendance &rarr;
              </Link>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal staggerChildren="[data-session-card]" distance={22}>
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: SessionCardSlot }) {
  const chip = session.status ? STATUS_CHIP[session.status] : undefined
  return (
    <TiltCard
      data-session-card
      maxTilt={2}
      lift={2}
      glare={false}
      className="card-surface-hover p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-4">
        {/* Period number badge */}
        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-bold text-base flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-normal leading-none uppercase text-blue-600">P</span>
          <span>{session.periodNumber}</span>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {session.subjectCode}
            </span>
            {session.isLab && (
              <span className="badge-soft bg-sky-50 text-sky-700 border border-sky-200 text-[10px]">
                Lab Block (Single-tap Supported)
              </span>
            )}
            {chip && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${chip.className}`}
              >
                {chip.label}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-sm text-gray-900 mt-1.5">{session.subjectName}</h3>

          <p className="text-xs text-gray-500 mt-1 font-mono">
            {session.startTime} - {session.endTime}
            {session.room ? ` • Room: ${session.room}` : ''}
          </p>
        </div>
      </div>

      <SessionAction session={session} />
    </TiltCard>
  )
}

function SessionAction({ session }: { session: SessionCardSlot }) {
  if (session.state === 'markable' && session.href) {
    const isCompleted = session.status === 'completed'
    return (
      <Link
        href={session.href}
        className={`inline-flex items-center gap-2 text-xs font-bold rounded-xl px-5 py-2.5 transition-all shadow-xs ${
          isCompleted
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            : 'btn-primary'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isCompleted ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          )}
        </svg>
        {isCompleted ? 'Edit Attendance' : 'Mark Attendance'}
      </Link>
    )
  }
  if (session.state === 'non-academic') {
    return <span className="text-xs text-gray-600">Non-academic — no attendance</span>
  }
  if (session.state === 'error') {
    return (
      <span className="text-xs text-red-600" title={session.message ?? undefined}>
        {session.message}
      </span>
    )
  }
  return <span className="text-xs text-gray-600">Slot Inactive</span>
}
