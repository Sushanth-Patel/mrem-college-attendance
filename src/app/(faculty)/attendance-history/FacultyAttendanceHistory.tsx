'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Reveal } from '@/components/motion'
import type { PastSessionItem, FacultyHistoryFilterOptions } from '@/lib/faculty/history'

type Props = {
  sessions: PastSessionItem[]
  filterOptions: FacultyHistoryFilterOptions
}

export default function FacultyAttendanceHistory({ sessions, filterOptions }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('ALL')
  const [selectedSection, setSelectedSection] = useState('ALL')
  const [selectedDate, setSelectedDate] = useState('')

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedSubject !== 'ALL' && s.subjectId !== selectedSubject) {
        return false
      }
      if (selectedSection !== 'ALL' && s.sectionId !== selectedSection) {
        return false
      }
      if (selectedDate && s.sessionDate !== selectedDate) {
        return false
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchCode = s.subjectCode.toLowerCase().includes(query)
        const matchName = s.subjectName.toLowerCase().includes(query)
        const matchSection = s.sectionName.toLowerCase().includes(query)
        const matchDate = s.sessionDate.includes(query)
        if (!matchCode && !matchName && !matchSection && !matchDate) {
          return false
        }
      }
      return true
    })
  }, [sessions, selectedSubject, selectedSection, selectedDate, searchQuery])

  // Aggregate stats
  const totalConducted = sessions.length
  const totalRecords = sessions.reduce((acc, s) => acc + s.totalCount, 0)
  const totalPresent = sessions.reduce((acc, s) => acc + s.presentCount, 0)
  const avgAttendance = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0

  const handleExportCsv = () => {
    const headers = ['Session Date', 'Period', 'Subject Code', 'Subject Name', 'Section', 'Total Students', 'Present', 'Absent', 'Attendance %']
    const rows = filteredSessions.map((s) => [
      `"${s.sessionDate}"`,
      `"Period ${s.periodNumber || 1}"`,
      `"${s.subjectCode}"`,
      `"${s.subjectName.replace(/"/g, '""')}"`,
      `"${s.sectionName}"`,
      s.totalCount,
      s.presentCount,
      s.absentCount,
      `"${s.totalCount > 0 ? Math.round((s.presentCount / s.totalCount) * 100) : 0}%"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `MREM_Faculty_Attendance_Register_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Header Banner */}
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Faculty Portal
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500">Attendance Register</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
                Past Classes & Corrections
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Review past sessions taken on this platform. Correct mistakes or add missed attendance for your respective subjects.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
                title="Download formatted spreadsheet for Excel"
              >
                <span>📊</span>
                <span>Export to Excel / CSV</span>
              </button>
              <Link
                href="/take-attendance"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
              >
                <span>➕</span>
                <span>Mark New Class</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Strip */}
        <Reveal from="up" distance={16} delay={0.02}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Classes Marked</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalConducted}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Conducted sessions across subjects</p>
            </div>

            <div className="p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Student Attendance Records</p>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{totalRecords}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Total individual roll entries saved</p>
            </div>

            <div className="p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Turnout Rate</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-extrabold text-emerald-600">{avgAttendance}%</p>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Healthy
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Average student presence across all classes</p>
            </div>
          </div>
        </Reveal>

        {/* Filter Controls */}
        <Reveal from="up" distance={16} delay={0.05}>
          <div className="p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by subject code, name, or class..."
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Subject Filter */}
              <div className="sm:w-64">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Subjects ({filterOptions.subjects.length})</option>
                  {filterOptions.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className="sm:w-56">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">All Classes & Sections</option>
                  {filterOptions.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="sm:w-44">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Reset Button */}
              {(selectedSubject !== 'ALL' || selectedSection !== 'ALL' || selectedDate || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedSubject('ALL')
                    setSelectedSection('ALL')
                    setSelectedDate('')
                    setSearchQuery('')
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </Reveal>

        {/* Sessions List */}
        <Reveal from="up" distance={20} delay={0.08}>
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl font-bold mb-3">
                📋
              </div>
              <h3 className="text-base font-bold text-slate-900">No matching attendance sessions found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {sessions.length === 0
                  ? "You haven't marked any attendance sessions yet. Use the 'Mark New Class' button to take attendance."
                  : 'Try clearing your search or adjusting your subject and date filters.'}
              </p>
              {sessions.length === 0 && (
                <Link
                  href="/take-attendance"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  Take Attendance Now
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Showing {filteredSessions.length} Conducted Class{filteredSessions.length === 1 ? '' : 'es'}
                </p>
                <span className="text-[11px] text-slate-400">Click &quot;Edit &amp; Correct Attendance&quot; to modify marks</span>
              </div>

              {filteredSessions.map((s) => (
                <div
                  key={s.sessionId}
                  className="p-4 sm:p-5 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 hover:border-indigo-200 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  {/* Left Details */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                        📅 {s.sessionDate}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Period {s.periodNumber ?? 1}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        {s.sectionName}
                      </span>
                      {s.markedAtDisplay && (
                        <span className="text-[11px] text-slate-400">
                          Marked on {s.markedAtDisplay}
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>{s.subjectName}</span>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {s.subjectCode}
                        </span>
                      </h2>
                    </div>

                    {/* Attendance Counters */}
                    <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        <span>✓</span>
                        <span>{s.presentCount} Present</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                        <span>✕</span>
                        <span>{s.absentCount} Absent</span>
                      </span>
                      {s.excusedCount > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                          <span>OD: {s.excusedCount}</span>
                        </span>
                      )}
                      <span className="text-slate-400 font-medium">
                        Total Enrolled: {s.totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions & Percentage */}
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span
                        className={`inline-block text-sm font-black px-3 py-1 rounded-xl border ${
                          s.attendancePct >= 75
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {s.attendancePct}% Turnout
                      </span>
                    </div>

                    {s.canEdit ? (
                      <Link
                        href={`/marking/${s.sessionId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-95"
                      >
                        <span>✏️</span>
                        <span>Edit / Correct Attendance</span>
                      </Link>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 italic">
                        Restricted to subject faculty
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </div>
  )
}
