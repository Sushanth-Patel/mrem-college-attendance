'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatAcademicTerm } from '@/lib/academic'

type Branch = {
  id: string
  name: string
  code: string
}

type Section = {
  id: string
  branch_id: string
  year_of_study: number
  semester: 'odd' | 'even'
  academic_year: string
  section_name: string
  term_start_date: string
  is_active: boolean
  branches?: Branch | null
}

interface Props {
  initialSections: Section[]
  branches: Branch[]
}

export default function SectionsManager({ initialSections, branches }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedSem, setSelectedSem] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMode, setCreateMode] = useState<'single' | 'bulk'>('bulk')
  const [editSection, setEditSection] = useState<Section | null>(null)
  const [deleteSectionId, setDeleteSectionId] = useState<Section | null>(null)

  // Single Section Form State
  const [singleForm, setSingleForm] = useState({
    branch_id: branches[0]?.id || '',
    year_of_study: 1,
    semester: 'odd' as 'odd' | 'even',
    academic_year: '2025-2026',
    section_name: 'A',
    term_start_date: new Date().toISOString().slice(0, 10),
  })

  // Bulk Section Form State
  const [bulkForm, setBulkForm] = useState({
    branch_id: branches[0]?.id || '',
    year_of_study: 3,
    semester: 'odd' as 'odd' | 'even',
    academic_year: '2025-2026',
    count: 3,
    term_start_date: new Date().toISOString().slice(0, 10),
  })

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Filtered list
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      const branchCode = s.branches?.code || ''
      if (selectedBranch !== 'all' && s.branch_id !== selectedBranch && branchCode !== selectedBranch) {
        return false
      }
      if (selectedYear !== 'all' && s.year_of_study.toString() !== selectedYear) {
        return false
      }
      if (selectedSem !== 'all' && s.semester !== selectedSem) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = s.section_name.toLowerCase().includes(q)
        const matchBranch = (s.branches?.name || '').toLowerCase().includes(q) || branchCode.toLowerCase().includes(q)
        const matchAcad = s.academic_year.toLowerCase().includes(q)
        if (!matchName && !matchBranch && !matchAcad) return false
      }
      return true
    })
  }, [sections, selectedBranch, selectedYear, selectedSem, searchQuery])

  // Handle single create
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...singleForm }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create section')

      showToast('success', `✓ Section ${singleForm.section_name} created successfully!`)
      setShowCreateModal(false)
      router.refresh()
      // Optimistic update
      if (data.section) {
        setSections((prev) => [data.section, ...prev])
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error creating section')
    } finally {
      setLoading(false)
    }
  }

  // Handle bulk create
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_bulk', ...bulkForm }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create bulk sections')

      showToast('success', `✓ Created ${bulkForm.count} sections (A through ${String.fromCharCode(64 + bulkForm.count)}) successfully!`)
      setShowCreateModal(false)
      router.refresh()
      if (data.sections) {
        setSections((prev) => [...data.sections, ...prev.filter((p) => !data.sections.some((d: Section) => d.id === p.id))])
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error creating bulk sections')
    } finally {
      setLoading(false)
    }
  }

  // Handle update section
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSection) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: editSection.id,
          section_name: editSection.section_name,
          year_of_study: editSection.year_of_study,
          semester: editSection.semester,
          academic_year: editSection.academic_year,
          term_start_date: editSection.term_start_date,
          is_active: editSection.is_active,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update section')

      showToast('success', `✓ Section ${editSection.section_name} updated successfully!`)
      setEditSection(null)
      router.refresh()
      if (data.section) {
        setSections((prev) => prev.map((s) => (s.id === data.section.id ? data.section : s)))
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error updating section')
    } finally {
      setLoading(false)
    }
  }

  // Handle delete section
  const handleDeleteConfirm = async () => {
    if (!deleteSectionId) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: deleteSectionId.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete section')

      showToast('success', `✓ Section ${deleteSectionId.section_name} deleted.`)
      setSections((prev) => prev.filter((s) => s.id !== deleteSectionId.id))
      setDeleteSectionId(null)
      router.refresh()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Error deleting section')
    } finally {
      setLoading(false)
    }
  }

  // Handle toggle active
  const handleToggleStatus = async (sec: Section) => {
    try {
      const newStatus = !sec.is_active
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', id: sec.id, is_active: newStatus }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to toggle status')

      setSections((prev) =>
        prev.map((s) => (s.id === sec.id ? { ...s, is_active: newStatus } : s))
      )
      showToast('success', `✓ Section is now ${newStatus ? 'Active' : 'Retired'}`)
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Toggle error')
    }
  }

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-card border text-xs font-semibold flex items-center gap-2 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-500/50 text-emerald-700'
              : 'bg-rose-50 border-rose-500/50 text-rose-700'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Class & Section Management</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure branches (CSE, CSM, CSD, IOT, IT), academic years, semesters, and number of sections with term start dates.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition transform active:scale-95 w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create / Bulk Add Sections
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Sections</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sections.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Active Batches</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {sections.filter((s) => s.is_active).length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CSE Specializations</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">{branches.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Filtered View</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{filteredSections.length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-card flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search section, branch code, or academic year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} - {b.name}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        >
          <option value="all">All Years</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>

        <select
          value={selectedSem}
          onChange={(e) => setSelectedSem(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        >
          <option value="all">All Semesters</option>
          <option value="odd">Term 1</option>
          <option value="even">Term 2</option>
        </select>

        {(selectedBranch !== 'all' || selectedYear !== 'all' || selectedSem !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setSelectedBranch('all')
              setSelectedYear('all')
              setSelectedSem('all')
              setSearchQuery('')
            }}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Sections Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Branch & Department</th>
                <th className="px-6 py-3.5 font-semibold">Section</th>
                <th className="px-6 py-3.5 font-semibold">Year & Sem</th>
                <th className="px-6 py-3.5 font-semibold">Academic Year</th>
                <th className="px-6 py-3.5 font-semibold">Term Start Date</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredSections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No sections match your filter criteria. Click &quot;Create / Bulk Add Sections&quot; to configure new sections.
                  </td>
                </tr>
              ) : (
                filteredSections.map((sec) => {
                  const branchInfo = sec.branches
                  return (
                    <tr key={sec.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 text-xs">{branchInfo?.code ?? 'DEPT'}</span>
                        <span className="block text-[11px] text-gray-500 truncate max-w-xs">{branchInfo?.name ?? 'Branch'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 font-bold font-mono text-xs">
                          Sec {sec.section_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-700">Year {sec.year_of_study}</span>
                        <span className="text-[11px] text-gray-500 block font-mono">({formatAcademicTerm(sec.semester)})</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">{sec.academic_year}</td>
                      <td className="px-6 py-4 font-mono text-violet-700">{sec.term_start_date || 'Not set'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(sec)}
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition ${
                            sec.is_active
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500/30'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {sec.is_active ? '● Active' : '○ Retired'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setEditSection({ ...sec })}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-violet-700 text-xs font-semibold rounded-lg border border-gray-200 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteSectionId(sec)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg border border-rose-200 transition"
                        >
                          Delete
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

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-card animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Create Class Sections</h3>
                <p className="text-xs text-gray-500 mt-0.5">Configure individual or bulk sections for a department</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-900 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 mb-6">
              <button
                type="button"
                onClick={() => setCreateMode('bulk')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  createMode === 'bulk' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Bulk Count (e.g. 1 to 8 Sections)
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('single')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  createMode === 'single' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Single Custom Section
              </button>
            </div>

            {createMode === 'bulk' ? (
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Department / Branch
                  </label>
                  <select
                    value={bulkForm.branch_id}
                    onChange={(e) => setBulkForm({ ...bulkForm, branch_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Year of Study
                    </label>
                    <select
                      value={bulkForm.year_of_study}
                      onChange={(e) => setBulkForm({ ...bulkForm, year_of_study: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Semester
                    </label>
                    <select
                      value={bulkForm.semester}
                      onChange={(e) => setBulkForm({ ...bulkForm, semester: e.target.value as 'odd' | 'even' })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    >
                      <option value="odd">Term 1</option>
                      <option value="even">Term 2</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Number of Sections
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={bulkForm.count}
                      onChange={(e) => setBulkForm({ ...bulkForm, count: Number(e.target.value) })}
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-bold"
                    />
                    <span className="text-[10px] text-violet-700 mt-1 block">
                      Will create Sections: {Array.from({ length: bulkForm.count }, (_, i) => String.fromCharCode(65 + i)).join(', ')}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={bulkForm.academic_year}
                      onChange={(e) => setBulkForm({ ...bulkForm, academic_year: e.target.value })}
                      required
                      placeholder="e.g. 2025-2026"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Term Start Date
                  </label>
                  <input
                    type="date"
                    value={bulkForm.term_start_date}
                    onChange={(e) => setBulkForm({ ...bulkForm, term_start_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-600/30"
                  >
                    {loading ? 'Creating...' : `Generate ${bulkForm.count} Sections`}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Department / Branch
                  </label>
                  <select
                    value={singleForm.branch_id}
                    onChange={(e) => setSingleForm({ ...singleForm, branch_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Year of Study
                    </label>
                    <select
                      value={singleForm.year_of_study}
                      onChange={(e) => setSingleForm({ ...singleForm, year_of_study: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Semester
                    </label>
                    <select
                      value={singleForm.semester}
                      onChange={(e) => setSingleForm({ ...singleForm, semester: e.target.value as 'odd' | 'even' })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                    >
                      <option value="odd">Term 1</option>
                      <option value="even">Term 2</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Section Name
                    </label>
                    <input
                      type="text"
                      value={singleForm.section_name}
                      onChange={(e) => setSingleForm({ ...singleForm, section_name: e.target.value })}
                      required
                      placeholder="e.g. A, B, or Alpha"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={singleForm.academic_year}
                      onChange={(e) => setSingleForm({ ...singleForm, academic_year: e.target.value })}
                      required
                      placeholder="e.g. 2025-2026"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Term Start Date
                  </label>
                  <input
                    type="date"
                    value={singleForm.term_start_date}
                    onChange={(e) => setSingleForm({ ...singleForm, term_start_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-600/30"
                  >
                    {loading ? 'Creating...' : '+ Create Section'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editSection && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-card animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Section</h3>
                <p className="text-xs text-gray-500 mt-0.5">Modify section details, semester, or academic year</p>
              </div>
              <button
                onClick={() => setEditSection(null)}
                className="text-gray-500 hover:text-gray-900 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={editSection.section_name}
                    onChange={(e) => setEditSection({ ...editSection, section_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={editSection.academic_year}
                    onChange={(e) => setEditSection({ ...editSection, academic_year: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Year of Study
                  </label>
                  <select
                    value={editSection.year_of_study}
                    onChange={(e) => setEditSection({ ...editSection, year_of_study: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Semester
                  </label>
                  <select
                    value={editSection.semester}
                    onChange={(e) => setEditSection({ ...editSection, semester: e.target.value as 'odd' | 'even' })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                  >
                    <option value="odd">Term 1</option>
                    <option value="even">Term 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  Term Start Date
                </label>
                <input
                  type="date"
                  value={editSection.term_start_date || ''}
                  onChange={(e) => setEditSection({ ...editSection, term_start_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editSection.is_active}
                  onChange={(e) => setEditSection({ ...editSection, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-purple-500 bg-gray-50 border-gray-200"
                />
                <label htmlFor="edit_is_active" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Active Section Batch
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditSection(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-600/30"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteSectionId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-card animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Delete Section?</h3>
            <p className="text-xs text-gray-600 mt-2">
              Are you sure you want to delete <span className="font-bold text-violet-700">Sec {deleteSectionId.section_name}</span> ({deleteSectionId.branches?.code} - Year {deleteSectionId.year_of_study})?
            </p>
            <p className="text-[11px] text-rose-300/80 mt-2 bg-rose-50 p-3 rounded-xl border border-rose-200">
              Note: Deleting this section removes its associated timetable slots and roster associations.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteSectionId(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
