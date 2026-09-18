'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AttendanceHistoryItem } from '@/lib/student/dashboard'

type Props = {
  history: AttendanceHistoryItem[]
  rollNo?: string
  studentName?: string
}

export default function StudentHistoryClient({ history, rollNo, studentName }: Props) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'present' | 'absent'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    return history.filter((item) => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = item.subjectCode.toLowerCase().includes(q)
        const matchName = item.subjectName.toLowerCase().includes(q)
        const matchDate = (item.sessionDate || '').includes(q)
        if (!matchCode && !matchName && !matchDate) return false
      }
      return true
    })
  }, [history, filterStatus, searchQuery])

  const handleExportCsv = () => {
    const headers = ['Session Date', 'Period', 'Course Code', 'Subject Name', 'Status']
    const rows = filtered.map((r) => [
      `"${r.sessionDate || 'N/A'}"`,
      `"Period ${r.periodNumber || 1}"`,
      `"${r.subjectCode}"`,
      `"${r.subjectName.replace(/"/g, '""')}"`,
      `"${r.status.toUpperCase()}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `MREM_Attendance_Log_${rollNo || 'Student'}_${new Date().toISOString().split('T')[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Student Records
            </span>
            {rollNo && (
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {rollNo}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Period Attendance History
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Complete chronological audit log of all class sessions conducted and marked by faculty.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="btn-secondary text-xs py-2 px-3.5 rounded-xl shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Export this record log directly to Microsoft Excel or CSV"
          >
            <span>📊</span>
            <span>Export to Excel / CSV</span>
          </button>
          <Link
            href="/student/dashboard"
            className="btn-primary text-xs py-2 px-3.5 rounded-xl shadow-sm"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search by code, subject, date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-500">Status:</span>
          {(['ALL', 'present', 'absent'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-lg font-bold transition capitalize ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Date &amp; Period</th>
                <th className="px-6 py-3.5 font-semibold">Subject Code &amp; Title</th>
                <th className="px-6 py-3.5 font-semibold">Classroom</th>
                <th className="px-6 py-3.5 font-semibold text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                filtered.map((record) => {
                  const isPresent = record.status === 'present'

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono">
                        <span className="font-semibold text-gray-900 block">
                          {record.sessionDate ?? 'Date N/A'}
                        </span>
                        {record.periodNumber && (
                          <span className="text-[10px] text-sky-600 font-bold">
                            Period {record.periodNumber}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-700 font-mono block">
                          {record.subjectCode}
                        </span>
                        <span className="text-gray-700 text-xs font-medium">
                          {record.subjectName}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-gray-500 text-[11px] font-mono">
                          APJ-205 (MREM)
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
