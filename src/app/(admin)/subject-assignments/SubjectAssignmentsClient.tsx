'use client'

import { useState } from 'react'
import { Reveal } from '@/components/motion'

type AssignmentRequest = {
  id: string
  faculty_id: string
  year_of_study: number
  branch_code: string
  section_name: string
  subject_id: string | null
  subject_name: string
  subject_code: string
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles?: { full_name: string; email: string } | null
}

type FacultyMember = { id: string; name: string; email: string }
type SubjectItem = { id: string; code: string; name: string }
type SectionItem = { id: string; name: string; year: number; branch: string }

type Props = {
  initialRequests: AssignmentRequest[]
  facultyList: FacultyMember[]
  subjectList: SubjectItem[]
  sectionList: SectionItem[]
}

export default function SubjectAssignmentsClient({
  initialRequests,
  facultyList,
  subjectList,
  sectionList,
}: Props) {
  const [requests, setRequests] = useState<AssignmentRequest[]>(initialRequests)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Direct allocation form state
  const [selectedFacultyId, setSelectedFacultyId] = useState(facultyList[0]?.id || '')
  const [selectedSectionId, setSelectedSectionId] = useState(sectionList[0]?.id || '')
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectList[0]?.id || '')
  const [allocating, setAllocating] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Handle 1-click review of faculty requests
  const handleReview = async (requestId: string, action: 'approved' | 'rejected') => {
    setLoadingId(requestId)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/assignment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to process request')

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: action } : r))
      )
      showToast(`Request successfully ${action}!`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoadingId(null)
    }
  }

  // Handle Direct Admin Allocation
  const handleDirectAllocate = async (e: React.FormEvent) => {
    e.preventDefault()
    setAllocating(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/direct-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: selectedFacultyId,
          sectionId: selectedSectionId,
          subjectId: selectedSubjectId,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to allocate subject')

      showToast('Class & subject assigned directly to faculty member!')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to allocate')
    } finally {
      setAllocating(false)
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const reviewedRequests = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-semibold mb-2 border border-violet-100">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-pulse"></span>
            Academic Scheduling
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Faculty Class Allocations &amp; Opt-In Queue
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Approve teacher self-service class requests or directly assign faculty to department cohorts.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-2xl flex items-center justify-between shadow-sm">
          <span className="font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-2xl flex items-center justify-between shadow-sm">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 font-bold">✕</button>
        </div>
      )}

      {/* 1. Pending Requests Queue */}
      <Reveal from="up" distance={16} delay={0.03}>
        <div className="p-6 bg-white/95 backdrop-blur-sm rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Pending Faculty Opt-In Requests</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {pendingRequests.length} Pending Review
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Newly joined or reassigned faculty requesting permission to take attendance for a class.
              </p>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
              No pending faculty assignment requests at this time.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const isLoading = loadingId === req.id
                return (
                  <div
                    key={req.id}
                    className="p-4 bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {req.profiles?.full_name || 'Faculty Member'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600 font-mono">
                          {req.profiles?.email}
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {req.branch_code} Yr {req.year_of_study} - Sec {req.section_name}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-900">
                        {req.subject_name}{' '}
                        <span className="text-xs font-mono text-indigo-600">({req.subject_code})</span>
                      </p>

                      {req.notes && (
                        <p className="text-xs text-slate-500 italic">
                          &quot;{req.notes}&quot;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(req.id, 'approved')}
                        disabled={isLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <span>✓</span>
                        <span>Approve &amp; Assign</span>
                      </button>
                      <button
                        onClick={() => handleReview(req.id, 'rejected')}
                        disabled={isLoading}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Reveal>

      {/* 2. Direct Admin Allocation Tool */}
      <Reveal from="up" distance={16} delay={0.06}>
        <div className="p-6 bg-white/95 backdrop-blur-sm rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900">Direct Faculty Class Assignment</h2>
            <p className="text-xs text-slate-500">
              Directly link any faculty member to a specific course and section in the timetable.
            </p>
          </div>

          <form onSubmit={handleDirectAllocate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {/* Faculty Picker */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Faculty Member
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Section Picker */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Class Section
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
              >
                {sectionList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.branch} Yr{s.year} - Sec {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Picker */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Subject / Course
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
              >
                {subjectList.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={allocating}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {allocating ? 'Assigning...' : 'Assign Class to Faculty'}
              </button>
            </div>
          </form>
        </div>
      </Reveal>
    </div>
  )
}
