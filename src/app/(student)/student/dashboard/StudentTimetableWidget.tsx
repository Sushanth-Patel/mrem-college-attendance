'use client'

import { useState, useEffect } from 'react'
import { formatAcademicTerm } from '@/lib/academic'

type TimetableEntry = {
  id: string
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  period_number: number
  subject_name: string
  subject_code: string
  faculty_name: string
  room_no: string
  is_lab?: boolean
}

type PeriodSlot = {
  period: number
  time: string
  label: string
}

type TimetableResponse = {
  success: boolean
  hasTimetable: boolean
  section?: {
    name: string
    year: number
    semester: string
    branchCode: string
    branchName: string
  }
  periodSlots: PeriodSlot[]
  entries: TimetableEntry[]
}

const DAYS: { key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
]

export default function StudentTimetableWidget() {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Get current weekday key
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const todayKey = dayNames[new Date().getDay()]
  const defaultDay = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).includes(todayKey as any)
    ? (todayKey as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat')
    : 'mon'

  const [selectedDay, setSelectedDay] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'>(defaultDay)
  const [viewMode, setViewMode] = useState<'daily' | 'full_grid'>('daily')

  useEffect(() => {
    fetch('/api/student/timetable')
      .then((res) => res.json())
      .then((resData) => {
        setData(resData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center text-gray-500 text-xs">
        <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        Loading your class timetable...
      </div>
    )
  }

  if (!data?.hasTimetable || !data.entries.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 text-center text-gray-500 text-xs">
        <span className="text-sm font-bold text-gray-900 block mb-1">Class Weekly Timetable</span>
        No timetable has been published yet for your section. It will appear here once configured by the department.
      </div>
    )
  }

  // Create fast map: day_period -> entry
  const entryMap = new Map<string, TimetableEntry>()
  for (const e of data.entries) {
    entryMap.set(`${e.day_of_week}_${e.period_number}`, e)
  }

  // Today's entries
  const todaySchedule = data.periodSlots.map((slot) => {
    const entry = entryMap.get(`${selectedDay}_${slot.period}`)
    return {
      slot,
      entry,
    }
  })

  return (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-card space-y-6 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold mb-2">
            Weekly Schedule Matrix
          </div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Class Timetable</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data.section?.branchName} ({data.section?.branchCode}) • {formatAcademicTerm(data.section?.semester, data.section?.year)} - Sec {data.section?.name}
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 w-fit">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewMode === 'daily' ? 'bg-sky-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode('full_grid')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewMode === 'full_grid' ? 'bg-sky-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Full Week Grid
          </button>
        </div>
      </div>

      {/* DAY VIEW */}
      {viewMode === 'daily' && (
        <div className="space-y-5">
          {/* Day Pills */}
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedDay === d.key
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                    : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span>{d.label}</span>
                {d.key === defaultDay && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
            ))}
          </div>

          {/* Periods Timeline Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {todaySchedule.map(({ slot, entry }) => (
              <div
                key={slot.period}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  entry?.is_lab
                    ? 'bg-indigo-50 border-indigo-500/40 shadow-lg shadow-indigo-950/30'
                    : entry
                    ? 'bg-gray-50 border-sky-200 shadow-md'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-2">
                    <span className="font-bold text-sky-600 uppercase">{slot.label}</span>
                    <span>{slot.time}</span>
                  </div>

                  {entry ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs text-violet-700 font-mono">
                          {entry.subject_code}
                        </span>
                        {entry.is_lab && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 text-[9px] font-bold">
                            LAB
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-gray-900 leading-tight">
                        {entry.subject_name}
                      </h3>
                      {entry.faculty_name && (
                        <p className="text-[11px] text-gray-600 mt-2 flex items-center gap-1">
                          <span>👤</span> {entry.faculty_name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-gray-600 text-xs font-mono">
                      No Scheduled Class
                    </div>
                  )}
                </div>

                {entry?.room_no && (
                  <div className="pt-3 mt-3 border-t border-gray-200 text-[10px] text-gray-500 font-mono flex items-center justify-between">
                    <span>Venue</span>
                    <span className="text-gray-900 font-bold">{entry.room_no}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FULL WEEK GRID VIEW */}
      {viewMode === 'full_grid' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase border-b border-gray-200">
                <th className="p-3 text-left w-24">Day</th>
                {data.periodSlots.map((s) => (
                  <th key={s.period} className="p-3 font-semibold border-l border-gray-200">
                    <span className="block text-gray-900 font-mono">{s.label}</span>
                    <span className="text-[9px] text-sky-600 font-mono">{s.time}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {DAYS.map((d) => (
                <tr key={d.key} className="hover:bg-gray-50">
                  <td className="p-3 text-left font-bold text-gray-900 font-mono bg-gray-50">
                    {d.label}
                  </td>
                  {data.periodSlots.map((slot) => {
                    const cell = entryMap.get(`${d.key}_${slot.period}`)
                    return (
                      <td key={slot.period} className="p-2 border-l border-gray-200 align-top">
                        {cell ? (
                          <div
                            className={`p-2 rounded-xl border text-left space-y-0.5 ${
                              cell.is_lab
                                ? 'bg-indigo-50 border-indigo-500/40'
                                : 'bg-gray-50 border-sky-200'
                            }`}
                          >
                            <span className="font-bold text-sky-600 font-mono text-[10px] block">
                              {cell.subject_code}
                            </span>
                            <span className="text-gray-900 text-[11px] font-semibold block truncate">
                              {cell.subject_name}
                            </span>
                            {cell.faculty_name && (
                              <span className="text-gray-500 text-[10px] block truncate">
                                👤 {cell.faculty_name}
                              </span>
                            )}
                            {cell.room_no && (
                              <span className="text-gray-500 text-[9px] font-mono block truncate">
                                📍 {cell.room_no}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-600 font-mono">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
