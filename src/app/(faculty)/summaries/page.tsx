import { getFacultySubjectSummaries } from '@/lib/faculty/dashboard'

export default async function FacultySummariesPage() {
  const summaries = await getFacultySubjectSummaries().catch(() => [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Class Attendance Summaries</h1>
        <p className="text-xs text-gray-500 mt-1">
          Aggregated class attendance analytics for subjects and sections currently assigned to you.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {summaries.length === 0 ? (
          <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 text-sm">
            No class summary metrics available yet.
          </div>
        ) : (
          summaries.map((item) => {
            const isShortage = item.attendancePct !== null && item.attendancePct < 75

            return (
              <div
                key={item.subjectId + item.sectionId}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {item.subjectCode}
                    </span>
                    <span className={`text-xs font-mono font-bold ${
                      item.attendancePct === null
                        ? 'text-gray-500'
                        : isShortage
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}>
                      {item.attendancePct === null ? 'N/A' : `${item.attendancePct}%`}
                    </span>
                  </div>

                  <h2 className="font-bold text-base text-gray-900">{item.subjectName}</h2>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-sans">Periods Held</span>
                    <span className="text-base font-bold text-gray-900">{item.periodsHeld}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-sans">Attended Marks</span>
                    <span className="text-base font-bold text-emerald-600">{item.periodsAttended}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
