'use client'

import { useState, useMemo } from 'react'
import type { AttendanceHistoryItem, CourseAttendanceItem } from '@/lib/student/dashboard'

type Props = {
  allHistory: AttendanceHistoryItem[]
  subjectBreakdown: CourseAttendanceItem[]
  todayDate: string
}

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '09:30 AM', end: '10:20 AM' },
  2: { start: '10:20 AM', end: '11:10 AM' },
  3: { start: '11:20 AM', end: '12:10 PM' },
  4: { start: '12:10 PM', end: '01:00 PM' },
  5: { start: '01:40 PM', end: '02:30 PM' },
  6: { start: '02:30 PM', end: '03:20 PM' },
  7: { start: '03:20 PM', end: '04:10 PM' },
}

export default function StudentDayAttendanceInspector({
  allHistory,
  subjectBreakdown,
  todayDate,
}: Props) {
  const [activeTab, setActiveTab] = useState<'single_day' | 'date_range' | 'subject_drilldown'>('single_day')

  // Single Day Inspector state
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(todayDate)

  // Date Range state (defaults to past 30 days up to today)
  const defaultFromDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])
  const [fromDate, setFromDate] = useState<string>(defaultFromDate)
  const [toDate, setToDate] = useState<string>(todayDate)
  const [rangeStatusFilter, setRangeStatusFilter] = useState<'ALL' | 'present' | 'absent'>('ALL')

  // Subject Drilldown state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjectBreakdown[0]?.subjectId || 'ALL'
  )

  // 1. Compute Single Day Data
  const singleDayRecords = useMemo(() => {
    return allHistory.filter((r) => r.sessionDate === selectedSingleDate)
  }, [allHistory, selectedSingleDate])

  const singleDayHeld = singleDayRecords.length
  const singleDayAttended = singleDayRecords.filter((r) => r.status === 'present').length
  const singleDayAbsent = singleDayRecords.filter((r) => r.status === 'absent').length
  const singleDayPct = singleDayHeld > 0 ? Math.round((singleDayAttended / singleDayHeld) * 100) : null

  // 2. Compute Date Range Data
  const dateRangeRecords = useMemo(() => {
    return allHistory.filter((r) => {
      if (!r.sessionDate) return false
      if (fromDate && r.sessionDate < fromDate) return false
      if (toDate && r.sessionDate > toDate) return false
      if (rangeStatusFilter !== 'ALL' && r.status !== rangeStatusFilter) return false
      return true
    })
  }, [allHistory, fromDate, toDate, rangeStatusFilter])

  const rangeHeld = dateRangeRecords.length
  const rangeAttended = dateRangeRecords.filter((r) => r.status === 'present').length
  const rangeAbsent = dateRangeRecords.filter((r) => r.status === 'absent').length
  const rangePct = rangeHeld > 0 ? Math.round((rangeAttended / rangeHeld) * 100) : null

  // 3. Compute Subject Drilldown Data
  const subjectRecords = useMemo(() => {
    if (selectedSubjectId === 'ALL') return allHistory
    return allHistory.filter((r) => r.subjectId === selectedSubjectId)
  }, [allHistory, selectedSubjectId])

  const chosenSubject = subjectBreakdown.find((s) => s.subjectId === selectedSubjectId)

  return (
    <div className="card-surface p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Attendance Intelligence
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Interactive Log
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
            Day-by-Day Attendance &amp; Period Inspector
          </h2>
          <p className="text-xs text-slate-500">
            Inspect all periods attended or missed on any specific calendar day, date range, or individual subject.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('single_day')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'single_day'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📅 Single Day Inspector
          </button>
          <button
            onClick={() => setActiveTab('date_range')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'date_range'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Date Range Filter
          </button>
          <button
            onClick={() => setActiveTab('subject_drilldown')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'subject_drilldown'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📚 Subject Drill-Down
          </button>
        </div>
      </div>

      {/* TAB 1: Single Day Inspector */}
      {activeTab === 'single_day' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Choose Date:</label>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => setSelectedSingleDate(e.target.value)}
                className="p-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setSelectedSingleDate(todayDate)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl transition"
              >
                Jump to Today
              </button>
            </div>

            {/* Daily Summary Pill */}
            <div className="flex items-center gap-2 text-xs">
              {singleDayHeld === 0 ? (
                <span className="font-semibold text-slate-500">No classes conducted on this date</span>
              ) : (
                <>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    ✓ {singleDayAttended} Attended
                  </span>
                  {singleDayAbsent > 0 && (
                    <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                      ✕ {singleDayAbsent} Absent
                    </span>
                  )}
                  <span className="font-mono font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    {singleDayPct}% Day Aggregate
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Periods Timeline on Single Day */}
          {singleDayHeld === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-500">
                No attendance sessions were recorded for <strong>{selectedSingleDate}</strong>. Classes might not have been held or attendance is pending.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {singleDayRecords.map((r) => {
                const isPresent = r.status === 'present'
                const periodNum = r.periodNumber || 1
                const timing = PERIOD_TIMES[periodNum] || { start: 'Period', end: `${periodNum}` }

                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border transition shadow-2xs ${
                      isPresent
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                        : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200">
                        Period {periodNum}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {timing.start} - {timing.end}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {r.subjectName}
                      </h4>
                      <span className="text-[10px] font-mono text-indigo-700 font-bold block">
                        {r.subjectCode}
                      </span>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">Lecture Hall APJ-205</span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                          isPresent
                            ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100/80 text-rose-800 border-rose-300'
                        }`}
                      >
                        {isPresent ? '✓ Present' : '✕ Absent'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Date Range Filter */}
      {activeTab === 'date_range' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Status Filter
                </label>
                <select
                  value={rangeStatusFilter}
                  onChange={(e) => setRangeStatusFilter(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  <option value="ALL">All Marks (Present &amp; Absent)</option>
                  <option value="present">Present Classes Only</option>
                  <option value="absent">Absences Only</option>
                </select>
              </div>
            </div>

            {/* Range Aggregate Metric Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-600">
                  Classes Held in Range: <strong>{rangeHeld}</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  Attended: {rangeAttended}
                </span>
                <span className="text-rose-700 font-bold">
                  Missed: {rangeAbsent}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 mr-2">Range Attendance:</span>
                <span
                  className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border ${
                    rangePct !== null && rangePct >= 75
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {rangePct === null ? 'N/A' : `${rangePct}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Range List Table */}
          {dateRangeRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No classes recorded in the selected date range.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-center">Period</th>
                    <th className="py-2.5 px-4">Course Code</th>
                    <th className="py-2.5 px-4">Subject Title</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dateRangeRecords.map((r) => {
                    const isPresent = r.status === 'present'
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{r.sessionDate}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-600">P{r.periodNumber || 1}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{r.subjectCode}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{r.subjectName}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isPresent
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Subject Drill-Down */}
      {activeTab === 'subject_drilldown' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Select Course:</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="p-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
              >
                <option value="ALL">All Enrolled Courses</option>
                {subjectBreakdown.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>
                    {s.subjectCode} - {s.subjectName}
                  </option>
                ))}
              </select>
            </div>

            {chosenSubject && (
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-slate-500">Subject Standing:</span>
                <span className="text-slate-800 font-mono">
                  {chosenSubject.periodsAttended} / {chosenSubject.periodsHeld} Held
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg border font-mono ${
                    chosenSubject.isShortage
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {chosenSubject.displayPct}
                </span>
              </div>
            )}
          </div>

          {/* Chronological sessions for this subject */}
          {subjectRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No sessions conducted yet for this subject.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Session Date</th>
                    <th className="py-2.5 px-4 text-center">Period</th>
                    <th className="py-2.5 px-4">Course</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {subjectRecords.map((r) => {
                    const isPresent = r.status === 'present'
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{r.sessionDate}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-600">P{r.periodNumber || 1}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <span className="font-bold font-mono text-indigo-700 mr-2">{r.subjectCode}</span>
                          {r.subjectName}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isPresent
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
