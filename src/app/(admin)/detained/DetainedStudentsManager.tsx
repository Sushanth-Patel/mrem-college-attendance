'use client'

import { useState, useMemo } from 'react'
import type { DetainedStudentItem } from '@/lib/admin/detained'

type Props = {
  initialStudents: DetainedStudentItem[]
  branches: Array<{ id: string; name: string; code: string }>
  sections: Array<{ id: string; section_name: string; year_of_study: number; branch_id: string }>
}

export default function DetainedStudentsManager({ initialStudents, branches, sections }: Props) {
  const [students, setStudents] = useState<DetainedStudentItem[]>(initialStudents)
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')
  const [branchFilter, setBranchFilter] = useState<string | 'all'>('all')
  const [sectionFilter, setSectionFilter] = useState<string | 'all'>('all')
  const [statusTab, setStatusTab] = useState<'detained' | 'all'>('detained')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filter sections by selected branch and year
  const availableSections = useMemo(() => {
    return sections.filter((sec) => {
      const matchBranch = branchFilter === 'all' || sec.branch_id === branchFilter
      const matchYear = yearFilter === 'all' || sec.year_of_study === yearFilter
      return matchBranch && matchYear
    })
  }, [sections, branchFilter, yearFilter])

  // Filter students list
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const matchStatus = statusTab === 'all' || st.accountStatus === 'detained'
      const matchSearch =
        !search.trim() ||
        st.rollNo.toLowerCase().includes(search.toLowerCase()) ||
        st.fullName.toLowerCase().includes(search.toLowerCase())
      const matchYear = yearFilter === 'all' || st.yearOfStudy === yearFilter
      const matchBranch = branchFilter === 'all' || st.branchName.toLowerCase().includes(branchFilter.toLowerCase())
      const matchSection = sectionFilter === 'all' || st.sectionId === sectionFilter

      return matchStatus && matchSearch && matchYear && matchBranch && matchSection
    })
  }, [students, search, yearFilter, branchFilter, sectionFilter, statusTab])

  // Toggle status between active and detained
  const handleToggleStatus = async (student: DetainedStudentItem) => {
    const newStatus = student.accountStatus === 'detained' ? 'active' : 'detained'
    const confirmMessage =
      newStatus === 'active'
        ? `Reinstate ${student.fullName} (${student.rollNo}) to active class attendance roll?`
        : `Mark ${student.fullName} (${student.rollNo}) as Detained? They will be excluded from daily attendance rolls.`

    if (!window.confirm(confirmMessage)) return

    setUpdatingId(student.id)
    setNotification(null)

    try {
      const res = await fetch('/api/admin/detained', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          newStatus,
        }),
      })

      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to update student status')
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, accountStatus: newStatus } : s))
      )

      setNotification({
        type: 'success',
        message: `${student.fullName} (${student.rollNo}) status updated to ${newStatus.toUpperCase()}.`,
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error updating student detention status.',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  // Export Detained Students to CSV
  const handleExportCsv = () => {
    const headers = ['Hall Ticket No', 'Student Full Name', 'Branch', 'Year', 'Section', 'Conducted', 'Attended', 'Attendance %', 'Shortage %', 'Category', 'Status']
    const rows = filteredStudents.map((st) => [
      st.rollNo,
      `"${st.fullName}"`,
      st.branchCode,
      st.yearOfStudy,
      st.sectionName,
      st.periodsHeld,
      st.periodsAttended,
      st.overallPct !== null ? `${st.overallPct}%` : 'N/A',
      `${st.shortagePct}%`,
      st.category === 'critical' ? 'Critical Detention (<65%)' : 'Condonation Zone (65-75%)',
      st.accountStatus.toUpperCase(),
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `detained_students_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Info Notice Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 inline-flex items-center justify-center font-bold text-xs flex-shrink-0">
            ⚠
          </span>
          <p className="leading-snug">
            <strong>Attendance Safeguard:</strong> Students with <strong>Detained</strong> status are automatically excluded from regular daily class attendance marking rolls so faculty only mark active enrolled students.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="btn-secondary text-xs py-1.5 px-3 rounded-xl whitespace-nowrap self-start sm:self-auto"
        >
          📥 Export List (.CSV)
        </button>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200/90 space-y-4">
        {/* Top Row: Search & Status Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Hall Ticket No or Name..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusTab('detained')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusTab === 'detained'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Detained Students ({students.filter((s) => s.accountStatus === 'detained').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusTab === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Shortage Cases ({students.length})
            </button>
          </div>
        </div>

        {/* Dropdowns Row: Year, Branch, Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Year of Study
            </label>
            <select
              value={yearFilter}
              onChange={(e) => {
                const val = e.target.value
                setYearFilter(val === 'all' ? 'all' : parseInt(val, 10))
                setSectionFilter('all')
              }}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Academic Years</option>
              <option value="1">1st Year (B.Tech)</option>
              <option value="2">2nd Year (B.Tech)</option>
              <option value="3">3rd Year (B.Tech)</option>
              <option value="4">4th Year (B.Tech)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Branch / Department
            </label>
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value)
                setSectionFilter('all')
              }}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Class Section
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Year {sec.year_of_study} - Section {sec.section_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Detained Students Table */}
      <div className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {statusTab === 'detained' ? 'Detained Student Roster' : 'Shortage & Condonation Candidates'}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Showing {filteredStudents.length} candidate(s) below mandatory university threshold
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            Cutoff: 75.0%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-5 py-3 font-semibold">Hall Ticket</th>
                <th className="px-5 py-3 font-semibold">Student Name</th>
                <th className="px-5 py-3 font-semibold">Class Cohort</th>
                <th className="px-5 py-3 font-semibold text-center">Conducted</th>
                <th className="px-5 py-3 font-semibold text-center">Attended</th>
                <th className="px-5 py-3 font-semibold text-right">Aggregate %</th>
                <th className="px-5 py-3 font-semibold text-center">Eligibility Category</th>
                <th className="px-5 py-3 font-semibold text-center">Current Status</th>
                <th className="px-5 py-3 font-semibold text-right">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                    No students found matching the selected detention filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const isCritical = st.category === 'critical'
                  const isDetained = st.accountStatus === 'detained'
                  const isUpdating = updatingId === st.id

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-700">
                        {st.rollNo}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {st.fullName}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {st.branchCode} • Year {st.yearOfStudy} ({st.sectionName})
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono text-gray-500">
                        {st.periodsHeld}
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono font-bold text-gray-800">
                        {st.periodsAttended}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        <span
                          className={
                            isCritical
                              ? 'text-rose-600'
                              : st.overallPct !== null && st.overallPct < 75
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {st.overallPct !== null ? `${st.overallPct}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isCritical ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            Critical (&lt;65%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                            Condonable (65–75%)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isDetained ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            Detained
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isDetained ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(st)}
                            className="btn-secondary text-[11px] py-1 px-2.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border-emerald-300 disabled:opacity-50"
                          >
                            {isUpdating ? 'Reinstating...' : '✓ Reinstate to Active'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(st)}
                            className="btn-secondary text-[11px] py-1 px-2.5 rounded-lg text-rose-700 hover:bg-rose-50 border-rose-300 disabled:opacity-50"
                          >
                            {isUpdating ? 'Detaining...' : '⚠ Mark Detained'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
