'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Reveal } from '@/components/motion'
import type { AssignedClassCard } from '@/lib/faculty/dashboard'

type Branch = { id: string; name: string; code: string }
type Section = {
  id: string
  section_name: string
  year_of_study: number
  semester: string
  academic_year: string
  branch_id: string
  branches?: { name: string; code: string } | null
}
type Subject = { id: string; name: string; code: string; is_lab: boolean }

type Props = {
  assignedCards: AssignedClassCard[]
  branches: Branch[]
  sections: Section[]
  subjects: Subject[]
  todayDate: string
}

export default function TakeAttendanceHub({
  assignedCards,
  branches,
  sections,
  subjects,
  todayDate,
}: Props) {
  const router = useRouter()

  // State for quick launching
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Selected date/period for assigned cards (defaults to today)
  const [selectedDateByCard, setSelectedDateByCard] = useState<Record<string, string>>({})
  const [selectedPeriodByCard, setSelectedPeriodByCard] = useState<Record<string, number>>({})

  // Modal for requesting class/subject opt-in
  const [showOptInModal, setShowOptInModal] = useState(false)
  const [optInYear, setOptInYear] = useState(4)
  const [optInBranch, setOptInBranch] = useState('CSE')
  const [optInSection, setOptInSection] = useState('A')
  const [optInSubjectId, setOptInSubjectId] = useState(subjects[0]?.id || '')
  const [optInNotes, setOptInNotes] = useState('')
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false)
  const [newSubjectCode, setNewSubjectCode] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectIsLab, setNewSubjectIsLab] = useState(false)
  const [submittingOptIn, setSubmittingOptIn] = useState(false)

  // Fallback manual selector accordion toggle
  const [showManualSelector, setShowManualSelector] = useState(assignedCards.length === 0)
  const [selectedYear, setSelectedYear] = useState<number>(4)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '')
  const [manualSessionDate, setManualSessionDate] = useState<string>(todayDate)
  const [manualPeriodNumber, setManualPeriodNumber] = useState<number>(1)

  const showToast = (text: string) => {
    setToastMessage(text)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // 1-Click Launch attendance for an assigned card
  const handleLaunchAssigned = async (card: AssignedClassCard) => {
    const cardKey = `${card.sectionId}:${card.subjectId}`
    const sessionDate = selectedDateByCard[cardKey] || todayDate
    const periodNumber = selectedPeriodByCard[cardKey] || card.todayScheduledPeriod || 1

    setOpeningSessionId(cardKey)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/attendance/open-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: card.sectionId,
          subjectId: card.subjectId,
          sessionDate,
          periodNumber,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to open class session')
      }

      router.push(`/marking/${data.sessionId}`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to launch attendance session')
      setOpeningSessionId(null)
    }
  }

  // Submit Opt-In Request
  const handleOptInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingOptIn(true)
    setErrorMessage(null)

    let payload: any

    if (isAddingNewSubject) {
      if (!newSubjectCode.trim() || !newSubjectName.trim()) {
        setErrorMessage('Please provide both Course Code and Title for the new subject.')
        setSubmittingOptIn(false)
        return
      }
      payload = {
        yearOfStudy: optInYear,
        branchCode: optInBranch,
        sectionName: optInSection.toUpperCase().trim(),
        subjectName: newSubjectName.trim(),
        subjectCode: newSubjectCode.toUpperCase().trim(),
        notes: `${newSubjectIsLab ? '[LAB] ' : '[THEORY] '}${optInNotes}`.trim(),
      }
    } else {
      const chosenSubject = subjects.find((s) => s.id === optInSubjectId) || subjects[0]
      payload = {
        yearOfStudy: optInYear,
        branchCode: optInBranch,
        sectionName: optInSection.toUpperCase().trim(),
        subjectId: chosenSubject?.id,
        subjectName: chosenSubject?.name || 'Course',
        subjectCode: chosenSubject?.code || 'SUB',
        notes: optInNotes,
      }
    }

    try {
      const res = await fetch('/api/faculty/assignment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit assignment request')
      }

      setShowOptInModal(false)
      setOptInNotes('')
      setNewSubjectCode('')
      setNewSubjectName('')
      setIsAddingNewSubject(false)
      showToast('Assignment request submitted to Administrator for approval.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmittingOptIn(false)
    }
  }

  // Filter sections for manual fallback
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const matchBranch = !selectedBranchId || sec.branch_id === selectedBranchId
      const matchYear = !selectedYear || sec.year_of_study === selectedYear
      return matchBranch && matchYear
    })
  }, [sections, selectedBranchId, selectedYear])

  const activeSection = useMemo(() => {
    if (selectedSectionId) {
      const found = filteredSections.find((s) => s.id === selectedSectionId)
      if (found) return found
    }
    return filteredSections[0] || null
  }, [filteredSections, selectedSectionId])

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null
  }, [subjects, selectedSubjectId])

  const handleManualOpenAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!activeSection) {
      setErrorMessage('Please select a valid class section.')
      return
    }
    if (!activeSubject) {
      setErrorMessage('Please select a course / subject.')
      return
    }

    setOpeningSessionId('manual')

    try {
      const res = await fetch('/api/attendance/open-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: activeSection.id,
          subjectId: activeSubject.id,
          sessionDate: manualSessionDate,
          periodNumber: manualPeriodNumber,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to open class session')
      }

      router.push(`/marking/${data.sessionId}`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to open class session')
      setOpeningSessionId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-2xl flex items-center justify-between shadow-sm">
          <span className="font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 font-bold">✕</button>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 text-xs rounded-2xl flex items-center justify-between shadow-sm">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 font-bold">✕</button>
        </div>
      )}

      {/* 1. Header with Request Opt-In Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>My Assigned Courses &amp; Classes</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {assignedCards.length} Allocated
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Click &quot;Take Attendance&quot; to open the marking roll instantly without selecting year or section.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOptInModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs"
          >
            <span>➕</span>
            <span>Request Subject / Class Opt-In</span>
          </button>
          <Link
            href="/attendance-history"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs"
          >
            <span>📋 Past Classes</span>
          </Link>
        </div>
      </div>

      {/* 2. Assigned Classes Direct Action Cards Grid */}
      <Reveal from="up" distance={16} delay={0.03}>
        {assignedCards.length === 0 ? (
          <div className="p-8 text-center bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl font-bold">
              📚
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Teaching Classes Assigned Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven&apos;t been assigned to any timetable classes by the Administrator yet. You can request a class allocation below.
            </p>
            <button
              onClick={() => setShowOptInModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Request Class Assignment Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedCards.map((card) => {
              const cardKey = `${card.sectionId}:${card.subjectId}`
              const isOpening = openingSessionId === cardKey
              const currDate = selectedDateByCard[cardKey] || todayDate
              const currPeriod = selectedPeriodByCard[cardKey] || card.todayScheduledPeriod || 1

              return (
                <div
                  key={cardKey}
                  className="p-5 bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    {/* Top Tag Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {card.sectionName}
                        </span>
                        {card.isLab && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            Laboratory
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-500">
                          Room {card.roomNo || 'APJ-205'}
                        </span>
                      </div>

                      {card.todayScheduledPeriod && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Today: P{card.todayScheduledPeriod}
                        </span>
                      )}
                    </div>

                    {/* Subject Title & Code */}
                    <div>
                      <h3 className="text-base font-black text-slate-900 leading-tight">
                        {card.subjectName}
                      </h3>
                      <span className="text-xs font-mono font-bold text-indigo-600 mt-0.5 block">
                        {card.subjectCode}
                      </span>
                    </div>

                    {/* Classes Taken Counter Strip */}
                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <span>📊</span>
                        <span>{card.classesTakenCount} Classes Conducted</span>
                      </span>
                    </div>
                  </div>

                  {/* Fast Controls & Launch Button */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={currDate}
                          onChange={(e) =>
                            setSelectedDateByCard((prev) => ({ ...prev, [cardKey]: e.target.value }))
                          }
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Period Slot
                        </label>
                        <select
                          value={currPeriod}
                          onChange={(e) =>
                            setSelectedPeriodByCard((prev) => ({
                              ...prev,
                              [cardKey]: parseInt(e.target.value, 10),
                            }))
                          }
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                            <option key={p} value={p}>
                              Period {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLaunchAssigned(card)}
                      disabled={isOpening}
                      className="w-full py-2.5 px-4 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isOpening ? (
                        <span>Opening Attendance Sheet...</span>
                      ) : (
                        <>
                          <span>⚡ Take Attendance for Period {currPeriod}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Reveal>

      {/* 3. Secondary Accordion: Manual Selector (for Covering / Proxy / Admin) */}
      <div className="pt-2">
        <button
          onClick={() => setShowManualSelector(!showManualSelector)}
          className="w-full p-4 bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200/80 rounded-2xl text-left flex items-center justify-between text-xs font-bold text-slate-700 transition"
        >
          <span className="flex items-center gap-2">
            <span>⚙️</span>
            <span>Manual Cohort Selector (For Emergency Covering / Special Sessions)</span>
          </span>
          <span>{showManualSelector ? '▲ Close' : '▼ Expand'}</span>
        </button>

        {showManualSelector && (
          <div className="p-6 mt-3 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <form onSubmit={handleManualOpenAttendance} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Year */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Year of Study
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                {/* Branch */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Branch / Department
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Class Section
                  </label>
                  <select
                    value={activeSection?.id || ''}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    {filteredSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.section_name} ({s.academic_year})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Course / Subject
                  </label>
                  <select
                    value={activeSubject?.id || ''}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={manualSessionDate}
                    onChange={(e) => setManualSessionDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Period Number
                  </label>
                  <select
                    value={manualPeriodNumber}
                    onChange={(e) => setManualPeriodNumber(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={openingSessionId === 'manual'}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition text-xs shadow-xs"
                >
                  {openingSessionId === 'manual' ? 'Opening...' : 'Launch Manual Sheet'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 4. Opt-In Request Modal */}
      {showOptInModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Request Class / Subject Allocation</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send a schedule assignment request to the Administrator for 1-click approval.
                </p>
              </div>
              <button
                onClick={() => setShowOptInModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOptInSubmit} className="space-y-3.5 text-xs">
              {/* Year */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Year of Study
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setOptInYear(y)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        optInYear === y
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Year {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Branch
                  </label>
                  <select
                    value={optInBranch}
                    onChange={(e) => setOptInBranch(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  >
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="IT">IT (Information Tech)</option>
                    <option value="CSM">CSM (AI &amp; ML)</option>
                    <option value="CSD">CSD (Data Science)</option>
                    <option value="IOT">IOT (Internet of Things)</option>
                    <option value="ECE">ECE (Electronics)</option>
                    <option value="EEE">EEE (Electrical)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Section Name (Caps)
                  </label>
                  <input
                    type="text"
                    value={optInSection}
                    onChange={(e) => setOptInSection(e.target.value.toUpperCase())}
                    placeholder="e.g. A, B, C"
                    maxLength={3}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold uppercase tracking-wider text-center"
                  />
                </div>
              </div>

              {/* Subject Dropdown or New Subject Entry */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assigned Subject / Course
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewSubject(!isAddingNewSubject)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    {isAddingNewSubject ? '← Choose Existing Subject' : '+ Add New Subject to Course'}
                  </button>
                </div>

                {!isAddingNewSubject ? (
                  <select
                    value={optInSubjectId}
                    onChange={(e) => setOptInSubjectId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name} ({s.is_lab ? 'Lab' : 'Theory'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2.5">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                      New Course Subject Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Subject Code</label>
                        <input
                          type="text"
                          value={newSubjectCode}
                          onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase())}
                          placeholder="e.g. CS706PE"
                          required
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Type</label>
                        <select
                          value={newSubjectIsLab ? 'lab' : 'theory'}
                          onChange={(e) => setNewSubjectIsLab(e.target.value === 'lab')}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                        >
                          <option value="theory">Theory Course</option>
                          <option value="lab">Laboratory (Lab)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">Subject Title</label>
                      <input
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="e.g. Advanced DevOps &amp; Site Reliability"
                        required
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Optional Notes for Administrator
                </label>
                <textarea
                  value={optInNotes}
                  onChange={(e) => setOptInNotes(e.target.value)}
                  placeholder="e.g. Newly joined faculty handling Theory & Lab sessions..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOptInModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOptIn}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {submittingOptIn ? 'Submitting...' : 'Send Request to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
