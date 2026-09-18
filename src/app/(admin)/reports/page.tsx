import { listSections } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { sectionId?: string; filterType?: string; threshold?: string }
}) {
  const supabase = await createClient()
  const sections = await listSections().catch(() => [])
  const activeSectionId = searchParams.sectionId || ''
  const parsedThreshold = Number(searchParams.threshold)
  const threshold = Number.isFinite(parsedThreshold) && parsedThreshold >= 0 && parsedThreshold <= 100 ? parsedThreshold : 75

  // Per-student attendance (held = recorded periods; see summary.ts), scoped
  // to the selected section so the table/KPIs match the dropdown filter.
  let sectionStudentIds: string[] | undefined
  if (activeSectionId) {
    const { data: scoped, error: scopedError } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', activeSectionId)
    if (scopedError) throw scopedError
    sectionStudentIds = (scoped ?? []).map((s) => s.id)
  }
  const reportRows = await fetchStudentSubjectAttendance({ studentIds: sectionStudentIds })

  // Defaulter count (below threshold) — needs names/rolls for display
  const studentIds = [...new Set(reportRows.map((r) => r.studentId))]
  const { data: directoryRows } = studentIds.length
    ? await supabase
        .from('students')
        .select('id, roll_no, profiles!inner(full_name)')
        .in('id', studentIds)
        .limit(500)
    : { data: [] }
  const directory = new Map(
    (directoryRows ?? []).map((s) => [
      s.id,
      {
        roll_no: s.roll_no as string,
        fullName: (s.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
      },
    ])
  )

  // Subject codes for display
  const subjectIds = [...new Set(reportRows.map((r) => r.subjectId))]
  const { data: subjectRows } = subjectIds.length
    ? await supabase.from('subjects').select('id, code, name').in('id', subjectIds)
    : { data: [] }
  const subjects = new Map((subjectRows ?? []).map((s) => [s.id, s]))
  const defaulters = reportRows.filter((r) => r.attendancePct !== null && r.attendancePct < threshold)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Reports &amp; Defaulters</h1>
          <p className="text-xs text-gray-500 mt-1">
            Generate college-wide or section-specific attendance records with instant Excel (.xlsx) and printable PDF export.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={`/api/admin/reports/excel${activeSectionId ? `?sectionId=${activeSectionId}` : ''}`}
            download="Attendance_Report.xlsx"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </a>
          <a
            href={`/api/admin/reports/pdf${activeSectionId ? `?sectionId=${activeSectionId}` : ''}`}
            download="Attendance_Report.pdf"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-purple-600/20 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </a>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Attendance Threshold</p>
          <form method="get" className="mt-2 flex items-center gap-2">
            {activeSectionId && <input type="hidden" name="sectionId" value={activeSectionId} />}
            <input
              name="threshold"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={threshold}
              className="w-24 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900"
              aria-label="Attendance threshold percentage"
            />
            <span className="text-lg font-bold text-gray-900">%</span>
            <button type="submit" className="px-2 py-1 bg-violet-600 hover:bg-violet-500 rounded-lg text-[10px] font-semibold text-white">
              Apply
            </button>
          </form>
          <span className="text-[10px] text-violet-600 mt-1 block">Used for this report and defaulter list</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Identified Defaulters (&lt; {threshold}%)</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{defaulters.length}</p>
          <span className="text-[10px] text-rose-600 mt-1 block">Subject-level shortage</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Low Attendance Alerts</p>
            <p className="text-xs text-gray-600 mt-1">Trigger throttled email batch to defaulters</p>
          </div>
          <button
            type="button"
            className="mt-2 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition text-center shadow-md shadow-rose-600/20"
          >
            Trigger Resend Alert Batch
          </button>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-gray-900">Class & Subject Attendance Breakdown</h2>

          <form method="get" className="flex items-center gap-2">
            <select
              name="sectionId"
              defaultValue={activeSectionId}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">All Sections</option>
              {sections.map((s) => {
                const branch = s.branches as { code: string } | null
                return (
                  <option key={s.id} value={s.id}>
                    {branch?.code ?? 'Dept'} - Yr {s.year_of_study} Sec {s.section_name}
                  </option>
                )
              })}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition"
            >
              Filter
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3 font-semibold">Student Roll No</th>
                <th className="px-6 py-3 font-semibold">Student Name</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold">Held</th>
                <th className="px-6 py-3 font-semibold">Attended</th>
                <th className="px-6 py-3 font-semibold text-right">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {(!reportRows || reportRows.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No attendance records computed yet. Once faculty marks sessions, real-time analytics will surface here.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, idx) => {
                  const student = directory.get(row.studentId)
                  const subject = subjects.get(row.subjectId)
                  const isShortage = row.attendancePct !== null && row.attendancePct < threshold

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">
                        {student?.roll_no ?? row.studentId.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        {student?.fullName ?? 'Enrolled Student'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-violet-700 font-mono">{subject?.code ?? 'SUB'}</span>
                        <span className="text-gray-500 block text-[11px]">{subject?.name ?? ''}</span>
                      </td>
                      <td className="px-6 py-4 font-mono">{row.periodsHeld}</td>
                      <td className="px-6 py-4 font-mono text-emerald-600">{row.periodsAttended}</td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            row.attendancePct === null
                              ? 'text-gray-500'
                              : isShortage
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {row.attendancePct === null ? 'N/A' : `${row.attendancePct}%`}
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
