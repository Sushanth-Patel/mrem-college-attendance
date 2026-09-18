import { listSubjects, listBranches } from '@/lib/admin'
import { createSubject } from '@/lib/admin/subjects'
import { revalidatePath } from 'next/cache'
import { formatAcademicTerm } from '@/lib/academic'

export default async function SubjectsPage() {
  const [subjects, branches] = await Promise.all([
    listSubjects().catch(() => []),
    listBranches().catch(() => []),
  ])

  async function handleCreateSubject(formData: FormData) {
    'use server'
    const branch_id = formData.get('branch_id') as string
    const year_of_study = Number(formData.get('year_of_study'))
    const semester = formData.get('semester') as 'odd' | 'even'
    const code = (formData.get('code') as string).trim().toUpperCase()
    const name = (formData.get('name') as string).trim()
    const subject_type = formData.get('subject_type') as 'theory' | 'lab' | 'project'
    const track_attendance = formData.get('track_attendance') === 'on'

    if (!branch_id || !year_of_study || !semester || !code || !name || !subject_type) {
      return
    }

    await createSubject({
      branch_id,
      year_of_study,
      semester,
      code,
      name,
      subject_type,
      track_attendance,
    })
    revalidatePath('/subjects')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Subjects & Course Units</h1>
        <p className="text-xs text-gray-500 mt-1">
          Theory and Laboratory courses are maintained independently with dedicated subject codes and separate attendance thresholds.
        </p>
      </div>

      {/* Create Subject Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Add Course Subject</h2>
        <form action={handleCreateSubject} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Branch
            </label>
            <select
              name="branch_id"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Subject Code
            </label>
            <input
              type="text"
              name="code"
              required
              placeholder="e.g. CS701PC"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 uppercase focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Subject Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Cryptography & Network Security"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Year & Sem
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                name="year_of_study"
                required
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="4">4th Yr</option>
                <option value="3">3rd Yr</option>
                <option value="2">2nd Yr</option>
                <option value="1">1st Yr</option>
              </select>
              <select
                name="semester"
                required
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="odd">Term 1</option>
                <option value="even">Term 2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Type
            </label>
            <select
              name="subject_type"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            >
              <option value="theory">Theory</option>
              <option value="lab">Lab (Multi-Period Block)</option>
              <option value="project">Project Stage-I</option>
            </select>
          </div>

          <div className="sm:col-span-3 lg:col-span-6 flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" name="track_attendance" defaultChecked className="rounded text-violet-600 focus:ring-purple-500 w-4 h-4" />
              <span>Track attendance for percentage calculation (Uncheck for Library/Sports reference slots)</span>
            </label>
            <button
              type="submit"
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-purple-600/30"
            >
              + Create Subject
            </button>
          </div>
        </form>
      </div>

      {/* Subjects Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Configured Subjects ({subjects.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3 font-semibold">Code</th>
                <th className="px-6 py-3 font-semibold">Subject Title</th>
                <th className="px-6 py-3 font-semibold">Department</th>
                <th className="px-6 py-3 font-semibold">Year & Sem</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold text-right">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No subjects configured yet. Add your curriculum subjects above.
                  </td>
                </tr>
              ) : (
                subjects.map((sub) => {
                  const branchInfo = sub.branches as { name: string; code: string } | null
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-violet-700">{sub.code}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{sub.name}</td>
                      <td className="px-6 py-4">{branchInfo?.code ?? 'N/A'}</td>
                      <td className="px-6 py-4">Yr {sub.year_of_study} ({formatAcademicTerm(sub.semester)})</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          sub.subject_type === 'lab'
                            ? 'bg-sky-50 text-sky-600 border border-sky-200'
                            : sub.subject_type === 'project'
                            ? 'bg-violet-50 text-violet-700 border border-violet-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {sub.subject_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[11px] font-semibold ${sub.track_attendance ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {sub.track_attendance ? '✓ Evaluated' : 'Excluded'}
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
