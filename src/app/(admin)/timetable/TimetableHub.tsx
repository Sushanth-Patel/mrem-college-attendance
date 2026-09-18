'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { formatAcademicTerm } from '@/lib/academic'

type Section = {
  id: string
  section_name: string
  year_of_study: number
  semester: string
  academic_year: string
  is_active: boolean
  totalSlots?: number
  hasTimetable?: boolean
  branches?: {
    id?: string
    name: string
    code: string
  } | null
}

type TimetableCell = {
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  period_number: number
  subject_name: string
  subject_code: string
  faculty_name: string
  room_no: string
  is_lab?: boolean
}

const PERIOD_SLOTS = [
  { period: 1, time: '09:30 - 10:20', label: 'Period 1' },
  { period: 2, time: '10:20 - 11:10', label: 'Period 2' },
  { period: 3, time: '11:20 - 12:10', label: 'Period 3' },
  { period: 4, time: '12:10 - 01:00', label: 'Period 4' },
  { period: 5, time: '01:40 - 02:30', label: 'Period 5' },
  { period: 6, time: '02:30 - 03:20', label: 'Period 6' },
  { period: 7, time: '03:20 - 04:10', label: 'Period 7' },
]

const DAYS: { key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
]

export default function TimetableHub() {
  const [activeTab, setActiveTab] = useState<'upload' | 'view_all'>('upload')
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 6 Days x 7 Periods Matrix State
  const [grid, setGrid] = useState<Record<string, TimetableCell>>({})

  // Preview / Inspection modal in "View All" tab
  const [inspectSection, setInspectSection] = useState<Section | null>(null)
  const [inspectGrid, setInspectGrid] = useState<Record<string, TimetableCell>>({})

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load all sections and timetables
  const loadSections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/timetable')
      const data = await res.json()
      if (data.timetables) {
        setSections(data.timetables)
        if (!selectedSectionId && data.timetables.length > 0) {
          // Select 4th year CSE if available, else first section
          const cse4 = data.timetables.find((s: Section) => s.year_of_study === 4 && (s.branches?.code === 'CSE' || !s.branches))
          const target = cse4 || data.timetables[0]
          setSelectedSectionId(target.id)
          loadSectionSchedule(target.id)
        }
      }
    } catch (err) {
      showToast('error', 'Failed to load timetable sections')
    } finally {
      setLoading(false)
    }
  }

  // Mount-only bootstrap: loadSections() seeds the section list and auto-selects
  // one, and re-running it on every render-identity change would clobber the
  // section the admin has since picked.
  useEffect(() => {
    loadSections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load schedule for selected section
  const loadSectionSchedule = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/admin/timetable?sectionId=${sectionId}`)
      const data = await res.json()
      const newGrid: Record<string, TimetableCell> = {}

      if (data.entries && data.entries.length > 0) {
        for (const e of data.entries) {
          const key = `${e.day_of_week}_${e.period_number}`
          newGrid[key] = {
            day_of_week: e.day_of_week,
            period_number: e.period_number,
            subject_name: e.subject_name || '',
            subject_code: e.subject_code || '',
            faculty_name: e.faculty_name || '',
            room_no: e.room_no || '',
            is_lab: !!e.is_lab,
          }
        }
      }
      setGrid(newGrid)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSectionChange = (secId: string) => {
    setSelectedSectionId(secId)
    loadSectionSchedule(secId)
  }

  // Cell change handler
  const handleCellChange = (
    day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat',
    period: number,
    field: keyof TimetableCell,
    val: string | boolean
  ) => {
    const key = `${day}_${period}`
    const existing = grid[key] || {
      day_of_week: day,
      period_number: period,
      subject_name: '',
      subject_code: '',
      faculty_name: '',
      room_no: '',
      is_lab: false,
    }
    setGrid({
      ...grid,
      [key]: {
        ...existing,
        [field]: val,
      },
    })
  }

  // Clear current grid
  const handleClearGrid = () => {
    setGrid({})
    showToast('success', 'Cleared grid inputs.')
  }

  // CSV / Excel File Upload for Timetable
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newGrid: Record<string, TimetableCell> = { ...grid }
        let count = 0

        for (const row of results.data) {
          const keys = Object.keys(row)
          const findVal = (patterns: string[]) => {
            const k = keys.find((key) => patterns.some((p) => key.toLowerCase().includes(p)))
            return k ? row[k]?.trim() : ''
          }

          const rawDay = findVal(['day', 'weekday']).toLowerCase().slice(0, 3)
          const validDay = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).find((d) => rawDay.startsWith(d))
          const period = Number(findVal(['period', 'slot', 'p_num', 'period_number'])) || 1
          const code = findVal(['code', 'sub_code', 'subject_code']) || ''
          const name = findVal(['subject', 'sub_name', 'name', 'course']) || ''
          const faculty = findVal(['faculty', 'teacher', 'instructor', 'staff']) || ''
          const room = findVal(['room', 'hall', 'lab', 'class']) || ''

          if (validDay && period >= 1 && period <= 7 && (name || code)) {
            const key = `${validDay}_${period}`
            newGrid[key] = {
              day_of_week: validDay,
              period_number: period,
              subject_code: code || name.slice(0, 4).toUpperCase(),
              subject_name: name || code,
              faculty_name: faculty,
              room_no: room,
              is_lab: name.toLowerCase().includes('lab') || room.toLowerCase().includes('lab'),
            }
            count++
          }
        }

        setGrid(newGrid)
        showToast('success', `✓ Successfully parsed and loaded ${count} timetable entries from file!`)
      },
      error: () => {
        showToast('error', 'Failed to parse timetable spreadsheet')
      },
    })
  }

  // Save timetable to database
  const handleSaveTimetable = async () => {
    if (!selectedSectionId) {
      showToast('error', 'Please select a target class & section')
      return
    }

    setSaving(true)
    try {
      const entries = Object.values(grid).filter((cell) => cell.subject_name.trim() || cell.subject_code.trim())
      const res = await fetch('/api/admin/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          entries,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      showToast('success', `✓ Timetable saved successfully (${entries.length} slots configured)!`)
      loadSections()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Open inspection modal in "View All"
  const handleInspectSection = async (sec: Section) => {
    setInspectSection(sec)
    try {
      const res = await fetch(`/api/admin/timetable?sectionId=${sec.id}`)
      const data = await res.json()
      const newGrid: Record<string, TimetableCell> = {}
      for (const e of data.entries || []) {
        const key = `${e.day_of_week}_${e.period_number}`
        newGrid[key] = {
          day_of_week: e.day_of_week,
          period_number: e.period_number,
          subject_name: e.subject_name || '',
          subject_code: e.subject_code || '',
          faculty_name: e.faculty_name || '',
          room_no: e.room_no || '',
          is_lab: !!e.is_lab,
        }
      }
      setInspectGrid(newGrid)
    } catch (err) {
      console.error(err)
    }
  }

  const currentSection = sections.find((s) => s.id === selectedSectionId)

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-card border text-xs font-semibold flex items-center gap-2 backdrop-blur-xl animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-500/50 text-emerald-700'
              : 'bg-rose-50 border-rose-500/50 text-rose-700'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">College Timetable Hub</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure, upload, and inspect weekly class schedules for specific Branch, Year, Semester, and Section.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'upload' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Upload & Edit Class Timetable
          </button>
          <button
            onClick={() => {
              setActiveTab('view_all')
              loadSections()
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'view_all' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            View All Uploaded Timetables ({sections.filter((s) => s.hasTimetable).length})
          </button>
        </div>
      </div>

      {/* TAB 1: UPLOAD & EDIT TIMETABLE */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Target Class Control Panel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-violet-700 uppercase tracking-wider mb-1">
                  Target Class & Section:
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 border border-purple-500/50 rounded-xl text-xs text-gray-900 font-bold focus:ring-2 focus:ring-purple-400 focus:outline-none min-w-[320px]"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.branches?.code || 'CSE'} • {formatAcademicTerm(s.semester, s.year_of_study)} - Sec {s.section_name} ({s.academic_year}) {s.hasTimetable ? '✓ Active' : '(No Timetable)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleClearGrid}
                  className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-xl border border-gray-200 transition transform active:scale-95 flex items-center gap-1.5"
                >
                  <span>↺ Clear Grid</span>
                </button>

                <label className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 cursor-pointer transition flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload Timetable CSV / Excel</span>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                </label>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveTimetable}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition transform active:scale-95 flex items-center gap-1.5"
                >
                  <span>{saving ? 'Saving...' : '💾 Save Class Timetable'}</span>
                </button>
              </div>
            </div>

            {currentSection && (
              <div className="pt-3 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
                <span>Selected: <strong className="text-gray-900">{currentSection.branches?.name || 'Computer Science'}</strong></span>
                <span>•</span>
                <span>{formatAcademicTerm(currentSection.semester, currentSection.year_of_study)}</span>
                <span>•</span>
                <span>Section: <strong className="text-violet-700">Sec {currentSection.section_name}</strong></span>
              </div>
            )}
          </div>

          {/* Interactive Weekly Timetable Matrix */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-[10px] uppercase tracking-wider border-b border-gray-200">
                    <th className="p-3 text-left w-28 font-bold">Day / Period</th>
                    {PERIOD_SLOTS.map((slot) => (
                      <th key={slot.period} className="p-3 font-bold border-l border-gray-200 min-w-[150px]">
                        <span className="block text-gray-900 font-mono">{slot.label}</span>
                        <span className="text-[10px] text-violet-700 font-mono font-normal">{slot.time}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {DAYS.map((day) => (
                    <tr key={day.key} className="hover:bg-gray-50 transition">
                      {/* Day Label */}
                      <td className="p-3 text-left font-bold text-gray-900 bg-gray-50 font-mono">
                        {day.label}
                      </td>

                      {/* 7 Periods */}
                      {PERIOD_SLOTS.map((slot) => {
                        const cellKey = `${day.key}_${slot.period}`
                        const cell = grid[cellKey] || {
                          day_of_week: day.key,
                          period_number: slot.period,
                          subject_name: '',
                          subject_code: '',
                          faculty_name: '',
                          room_no: '',
                          is_lab: false,
                        }

                        const hasData = cell.subject_name.trim() || cell.subject_code.trim()

                        return (
                          <td key={slot.period} className="p-2 border-l border-gray-200 align-top">
                            <div
                              className={`p-2.5 rounded-xl border text-left space-y-1.5 transition ${
                                cell.is_lab
                                  ? 'bg-indigo-50 border-indigo-500/40'
                                  : hasData
                                  ? 'bg-gray-50 border-violet-200'
                                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <input
                                  type="text"
                                  placeholder="Sub Code"
                                  value={cell.subject_code}
                                  onChange={(e) => handleCellChange(day.key, slot.period, 'subject_code', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-violet-700 font-mono font-bold uppercase focus:ring-1 focus:ring-purple-400 focus:outline-none"
                                />
                                <label className="flex items-center gap-1 text-[9px] text-gray-500 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!cell.is_lab}
                                    onChange={(e) => handleCellChange(day.key, slot.period, 'is_lab', e.target.checked)}
                                    className="rounded text-violet-600 scale-75"
                                  />
                                  <span>Lab</span>
                                </label>
                              </div>

                              <input
                                type="text"
                                placeholder="Subject Name (e.g. Deep Learning)"
                                value={cell.subject_name}
                                onChange={(e) => handleCellChange(day.key, slot.period, 'subject_name', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-[11px] text-gray-900 focus:ring-1 focus:ring-purple-400 focus:outline-none font-medium truncate"
                              />

                              <input
                                type="text"
                                placeholder="Faculty Name"
                                value={cell.faculty_name}
                                onChange={(e) => handleCellChange(day.key, slot.period, 'faculty_name', e.target.value)}
                                className="w-full px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600 focus:ring-1 focus:ring-purple-400 focus:outline-none truncate"
                              />

                              <input
                                type="text"
                                placeholder="Room / Lab (e.g. 401)"
                                value={cell.room_no}
                                onChange={(e) => handleCellChange(day.key, slot.period, 'room_no', e.target.value)}
                                className="w-full px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] text-gray-500 font-mono focus:ring-1 focus:ring-purple-400 focus:outline-none truncate"
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VIEW ALL UPLOADED TIMETABLES */}
      {activeTab === 'view_all' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card flex flex-col justify-between hover:border-violet-300 transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold font-mono">
                      {sec.branches?.code || 'CSE'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sec.hasTimetable
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {sec.hasTimetable ? `✓ Active (${sec.totalSlots} Slots)` : 'No Timetable'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900">
                    Year {sec.year_of_study} • Sec {sec.section_name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sec.branches?.name || 'Computer Science'} ({formatAcademicTerm(sec.semester)})
                  </p>
                  <span className="text-[10px] text-gray-500 font-mono block mt-1">
                    Academic Year: {sec.academic_year}
                  </span>
                </div>

                <div className="pt-6 mt-6 border-t border-gray-200 flex items-center gap-2">
                  <button
                    onClick={() => handleInspectSection(sec)}
                    className="flex-1 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-violet-700 text-xs font-semibold rounded-xl border border-violet-200 transition text-center"
                  >
                    View Timetable &rarr;
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSectionId(sec.id)
                      loadSectionSchedule(sec.id)
                      setActiveTab('upload')
                    }}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-xl transition"
                    title="Edit in Grid"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {inspectSection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-card flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {inspectSection.branches?.code || 'CSE'} Year {inspectSection.year_of_study} Sec {inspectSection.section_name} Timetable
                </h2>
                <p className="text-xs text-violet-700 font-mono">
                  {inspectSection.branches?.name} • {formatAcademicTerm(inspectSection.semester)} ({inspectSection.academic_year})
                </p>
              </div>
              <button
                onClick={() => setInspectSection(null)}
                className="text-gray-500 hover:text-gray-900 text-xl font-bold p-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase border-b border-gray-200">
                      <th className="p-3 text-left w-24">Day</th>
                      {PERIOD_SLOTS.map((s) => (
                        <th key={s.period} className="p-3 font-semibold border-l border-gray-200">
                          <span className="block text-gray-900">{s.label}</span>
                          <span className="text-[9px] text-violet-700 font-mono">{s.time}</span>
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
                        {PERIOD_SLOTS.map((slot) => {
                          const cell = inspectGrid[`${d.key}_${slot.period}`]
                          return (
                            <td key={slot.period} className="p-2 border-l border-gray-200 align-top">
                              {cell && (cell.subject_name || cell.subject_code) ? (
                                <div
                                  className={`p-2 rounded-xl border text-left space-y-0.5 ${
                                    cell.is_lab
                                      ? 'bg-indigo-50 border-indigo-500/40'
                                      : 'bg-gray-50 border-violet-200'
                                  }`}
                                >
                                  <span className="font-bold text-violet-700 font-mono text-[10px] block">
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
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setInspectSection(null)}
                className="px-5 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Close Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
