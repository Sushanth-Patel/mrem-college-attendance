'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatAcademicTerm } from '@/lib/academic'

type StudentSummary = {
  id: string
  rollNo: string
  fullName: string
  email: string
  fatherName: string
  collegeName: string
  branchCode: string
  branchName: string
  yearOfStudy: number
  semester: string
  sectionName: string
  sectionId: string
  phoneNumber: string
  parentPhoneNumber: string
  dob: string
  gender: string
  bloodGroup: string
  residenceType: 'day_scholar' | 'hosteller'
  busRoute: string
  hostelDetails: string
  address: string
  attendancePercentage: number
  totalClasses: number
  attendedClasses: number
  attendanceFlag: string
  accountStatus: string
}

type SubjectBreakdown = {
  code: string
  name: string
  total: number
  attended: number
  absent: number
  percentage: number
}

type SessionTimeline = {
  id: string
  status: 'present' | 'absent' | 'excused'
  date: string
  periodNumber: number
  subjectCode: string
  subjectName: string
  facultyName: string
}

type StudentDossier = {
  student: StudentSummary
  analytics: {
    overallPercentage: number
    totalSessions: number
    presentCount: number
    absentCount: number
    excusedCount: number
    statusLabel: string
    statusColor: string
  }
  subjectsBreakdown: SubjectBreakdown[]
  timeline: SessionTimeline[]
}

interface Props {
  initialBranch?: string
}

export default function StudentDirectory({ initialBranch = 'all' }: Props) {
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(initialBranch)
  const [selectedYear, setSelectedYear] = useState('all')

  // Selected student for full dossier inspection
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [dossier, setDossier] = useState<StudentDossier | null>(null)
  const [loadingDossier, setLoadingDossier] = useState(false)
  const [dossierTab, setDossierTab] = useState<'attendance' | 'subjects' | 'timeline' | 'profile'>('attendance')

  // Fetch student directory. useCallback so the debounce effect can depend on
  // it honestly instead of suppressing the dependency warning.
  const loadStudents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedBranch !== 'all') params.set('branch', selectedBranch)
    if (selectedYear !== 'all') params.set('year', selectedYear)

    fetch(`/api/admin/students/lookup?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.students) {
          setStudents(data.students)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [searchQuery, selectedBranch, selectedYear])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadStudents])

  // Open full dossier
  const handleOpenDossier = (studentId: string) => {
    setSelectedStudentId(studentId)
    setLoadingDossier(true)
    setDossier(null)
    setDossierTab('attendance')

    fetch(`/api/admin/students/${studentId}/attendance`)
      .then((res) => res.json())
      .then((data) => {
        if (data.student) {
          setDossier(data)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDossier(false))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Directory & Attendance Inspector</h1>
          <p className="text-xs text-gray-500 mt-1">
            Search any student by <span className="text-violet-700 font-mono">Email</span>, <span className="text-violet-700 font-mono">Roll Number</span>, or <span className="text-violet-700 font-mono">Name</span> to inspect individual profiles and real-time attendance records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold font-mono">
            {students.length} Students Indexed
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-card flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[260px] relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by student roll no, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </div>

        {/* Branch Filter */}
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        >
          <option value="all">All Departments</option>
          {Array.from(new Set(students.map((s) => s.branchCode).filter(Boolean))).sort().map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Year Filter */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        >
          <option value="all">All Years</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>

        {(searchQuery || selectedBranch !== 'all' || selectedYear !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedBranch('all')
              setSelectedYear('all')
            }}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Student List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Student & Roll No</th>
                <th className="px-6 py-3.5 font-semibold">Department & Class</th>
                <th className="px-6 py-3.5 font-semibold">Father&apos;s Name</th>
                <th className="px-6 py-3.5 font-semibold">Contact Details</th>
                <th className="px-6 py-3.5 font-semibold">Residence Status</th>
                <th className="px-6 py-3.5 font-semibold text-center">Attendance</th>
                <th className="px-6 py-3.5 font-semibold text-right">Student Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Searching students...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No students found matching your search. Try searching by email or roll number.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const isSafe = st.attendancePercentage >= 75
                  const isRisk = st.attendancePercentage >= 65 && st.attendancePercentage < 75

                  return (
                    <tr key={st.id} className="hover:bg-gray-50 transition">
                      {/* Name & Roll No */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/40 text-violet-700 flex items-center justify-center font-bold text-xs font-mono shadow">
                            {st.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{st.fullName}</span>
                            <span className="text-[11px] text-violet-700 font-mono font-semibold">{st.rollNo}</span>
                            <span className="text-[10px] text-gray-500 block truncate max-w-[180px]">{st.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Class */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-700 font-bold text-[10px] font-mono">
                          {st.branchCode}
                        </span>
                        <span className="text-[11px] text-gray-800 block mt-1 font-semibold">
                          {formatAcademicTerm(st.semester, st.yearOfStudy)} • Sec {st.sectionName}
                        </span>
                      </td>

                      {/* Father's Name */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-900 block">{st.fatherName || '—'}</span>
                        <span className="text-[10px] text-gray-500 block">{st.collegeName}</span>
                      </td>

                      {/* Contact Details */}
                      <td className="px-6 py-4">
                        {st.phoneNumber ? (
                          <span className="text-[11px] font-mono text-gray-700 block">📞 {st.phoneNumber}</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic block">No student mobile</span>
                        )}
                        {st.parentPhoneNumber ? (
                          <span className="text-[10px] font-mono text-amber-600 block mt-0.5 font-semibold">
                            👨‍👦 Parent: {st.parentPhoneNumber}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic block">No parent mobile</span>
                        )}
                      </td>

                      {/* Residence Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            st.residenceType === 'hosteller'
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {st.residenceType === 'hosteller' ? '🏢 Hosteller' : '🚌 Day Scholar'}
                        </span>
                        {st.busRoute && (
                          <span className="text-[10px] text-gray-500 block mt-1 truncate max-w-[140px] font-mono">
                            {st.busRoute}
                          </span>
                        )}
                        {st.hostelDetails && (
                          <span className="text-[10px] text-indigo-600 block mt-1 truncate max-w-[140px]">
                            {st.hostelDetails}
                          </span>
                        )}
                      </td>

                      {/* Attendance KPI */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-block">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold font-mono shadow ${
                              isSafe
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-500/40'
                                : isRisk
                                ? 'bg-amber-50 text-amber-600 border border-amber-500/40'
                                : 'bg-rose-50 text-rose-600 border border-rose-500/40'
                            }`}
                          >
                            {st.attendancePercentage}%
                          </span>
                          <span className="text-[9px] text-gray-500 block mt-1">
                            {st.attendedClasses}/{st.totalClasses} classes
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDossier(st.id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-violet-50 text-gray-700 hover:text-violet-700 font-semibold border border-gray-200 transition"
                        >
                          View Profile &rarr;
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL STUDENT PROFILE MODAL */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm">
                  {dossier?.student?.fullName.slice(0, 2).toUpperCase() || 'ST'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{dossier?.student?.fullName}</h2>
                  <p className="text-xs text-gray-500 font-mono">
                    Roll No: {dossier?.student?.rollNo} • {dossier?.student?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {loadingDossier || !dossier ? (
              <div className="p-16 text-center text-xs text-gray-500">
                <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                Loading comprehensive student attendance profile...
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3 text-xs font-semibold">
                  <button
                    onClick={() => setDossierTab('attendance')}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      dossierTab === 'attendance' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Attendance Overview
                  </button>
                  <button
                    onClick={() => setDossierTab('subjects')}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      dossierTab === 'subjects' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Subject Breakdown ({dossier.subjectsBreakdown.length})
                  </button>
                  <button
                    onClick={() => setDossierTab('timeline')}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      dossierTab === 'timeline' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Session History ({dossier.timeline.length})
                  </button>
                  <button
                    onClick={() => setDossierTab('profile')}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      dossierTab === 'profile' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Student Details
                  </button>
                </div>

                {/* TAB 1: Attendance Analytics */}
                {dossierTab === 'attendance' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-[11px] text-gray-500 uppercase font-semibold">Aggregate</span>
                        <p
                          className={`text-3xl font-extrabold font-mono mt-1 ${
                            dossier.analytics.overallPercentage >= 75
                              ? 'text-emerald-600'
                              : dossier.analytics.overallPercentage >= 65
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {dossier.analytics.overallPercentage}%
                        </p>
                        <span className="text-[10px] text-gray-500 block mt-1">{dossier.analytics.statusLabel}</span>
                      </div>

                      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Classes</span>
                        <p className="text-3xl font-extrabold text-gray-900 font-mono mt-1">
                          {dossier.analytics.totalSessions}
                        </p>
                        <span className="text-[10px] text-gray-500 block mt-1">Periods conducted</span>
                      </div>

                      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-[11px] text-gray-500 uppercase font-semibold">Attended</span>
                        <p className="text-3xl font-extrabold text-emerald-600 font-mono mt-1">
                          {dossier.analytics.presentCount}
                        </p>
                        <span className="text-[10px] text-emerald-600 block mt-1">Present Classes</span>
                      </div>

                      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-[11px] text-gray-500 uppercase font-semibold">Absent</span>
                        <p className="text-3xl font-extrabold text-rose-600 font-mono mt-1">
                          {dossier.analytics.absentCount}
                        </p>
                        <span className="text-[10px] text-rose-600 block mt-1">Periods missed</span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-900">Attendance Progress</span>
                        <span className="text-violet-700 font-mono font-bold">{dossier.analytics.overallPercentage}% (Target: 75%)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            dossier.analytics.overallPercentage >= 75
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : dossier.analytics.overallPercentage >= 65
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : 'bg-gradient-to-r from-rose-500 to-red-400'
                          }`}
                          style={{ width: `${Math.min(dossier.analytics.overallPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 pt-1 font-mono">
                        <span>0%</span>
                        <span className="text-rose-600">65% (Detention Line)</span>
                        <span className="text-amber-600">75% (Mandatory University Norm)</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SUBJECT-WISE BREAKDOWN */}
                {dossierTab === 'subjects' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Subject Code & Name</th>
                          <th className="px-5 py-3 font-semibold text-center">Classes Held</th>
                          <th className="px-5 py-3 font-semibold text-center">Attended</th>
                          <th className="px-5 py-3 font-semibold text-center">Absent</th>
                          <th className="px-5 py-3 font-semibold text-right">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {dossier.subjectsBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                              No subject attendance records found for this student.
                            </td>
                          </tr>
                        ) : (
                          dossier.subjectsBreakdown.map((subj, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 font-mono">
                              <td className="px-5 py-3 font-sans">
                                <span className="font-bold text-violet-700 font-mono block">{subj.code}</span>
                                <span className="text-gray-900 text-xs">{subj.name}</span>
                              </td>
                              <td className="px-5 py-3 text-center">{subj.total}</td>
                              <td className="px-5 py-3 text-center text-emerald-600">{subj.attended}</td>
                              <td className="px-5 py-3 text-center text-rose-600">{subj.absent}</td>
                              <td className="px-5 py-3 text-right">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                                    subj.percentage >= 75
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : subj.percentage >= 65
                                      ? 'bg-amber-50 text-amber-600'
                                      : 'bg-rose-50 text-rose-600'
                                  }`}
                                >
                                  {subj.percentage}%
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 3: SESSION TIMELINE */}
                {dossierTab === 'timeline' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Date & Period</th>
                          <th className="px-5 py-3 font-semibold">Subject</th>
                          <th className="px-5 py-3 font-semibold">Faculty In-charge</th>
                          <th className="px-5 py-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {dossier.timeline.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                              No session history logs available yet.
                            </td>
                          </tr>
                        ) : (
                          dossier.timeline.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-mono text-[11px]">
                                <span className="font-bold text-gray-900 block">{item.date}</span>
                                <span className="text-gray-500 text-[10px]">Period {item.periodNumber}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="font-bold text-violet-700 font-mono block">{item.subjectCode}</span>
                                <span className="text-gray-900 text-[11px]">{item.subjectName}</span>
                              </td>
                              <td className="px-5 py-3 text-gray-600">{item.facultyName}</td>
                              <td className="px-5 py-3 text-right font-mono">
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                    item.status === 'present'
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                      : item.status === 'excused'
                                      ? 'bg-sky-50 text-sky-600 border border-sky-200'
                                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* TAB 4: FULL PROFILE & CONTACT */}
                {dossierTab === 'profile' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Academic Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-500 block">Department</span>
                            <span className="font-bold text-gray-900">{dossier.student.branchName} ({dossier.student.branchCode})</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">Class & Section</span>
                            <span className="font-bold text-gray-900">Year {dossier.student.yearOfStudy} • Sec {dossier.student.sectionName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">Father&apos;s Name</span>
                            <span className="font-bold text-gray-900">{dossier.student.fatherName || 'Not recorded'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">College</span>
                            <span className="font-bold text-gray-900">{dossier.student.collegeName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Contact & Emergency</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-500 block">Student Mobile</span>
                            <span className="font-mono text-gray-900 font-bold">{dossier.student.phoneNumber || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">Parent Mobile</span>
                            <span className="font-mono text-amber-600 font-bold">{dossier.student.parentPhoneNumber || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">Date of Birth</span>
                            <span className="text-gray-900 font-mono">{dossier.student.dob || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">Blood Group</span>
                            <span className="text-gray-900 font-bold">{dossier.student.bloodGroup || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Residence & Address</h4>
                      <p className="text-gray-600">
                        <strong className="text-gray-900">Residence Type:</strong>{' '}
                        {dossier.student.residenceType === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
                      </p>
                      {dossier.student.busRoute && (
                        <p className="text-gray-600 font-mono">
                          <strong className="text-gray-900 font-sans">Bus Route / Stop:</strong> {dossier.student.busRoute}
                        </p>
                      )}
                      {dossier.student.hostelDetails && (
                        <p className="text-gray-600 font-mono">
                          <strong className="text-gray-900 font-sans">Hostel Details:</strong> {dossier.student.hostelDetails}
                        </p>
                      )}
                      {dossier.student.address && (
                        <p className="text-gray-600">
                          <strong className="text-gray-900">Communication Address:</strong> {dossier.student.address}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedStudentId(null)}
                className="px-5 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
