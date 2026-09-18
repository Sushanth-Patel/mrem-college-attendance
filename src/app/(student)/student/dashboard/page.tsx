import { getStudentDashboardData } from '@/lib/student/dashboard'
import Link from 'next/link'
import StudentTimetableWidget from './StudentTimetableWidget'
import StudentDayAttendanceInspector from './StudentDayAttendanceInspector'

export const dynamic = 'force-dynamic'

export default async function StudentDashboardPage() {
  const data = await getStudentDashboardData().catch((err) => {
    const message =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Failed to load student attendance data'
    return { error: message }
  })

  if ('error' in data) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center max-w-lg mx-auto mt-10 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">Unable to Load Academic Records</h2>
        <p className="text-xs text-gray-500 mb-6">{data.error}</p>
        <Link
          href="/login"
          className="btn-primary text-xs py-2 px-4 rounded-xl inline-block shadow-sm"
        >
          Sign In to Student Portal
        </Link>
      </div>
    )
  }

  const {
    studentProfile,
    totalHeld,
    totalAttended,
    totalMissed,
    overallPct,
    overallDisplayPct,
    standingTier,
    standingLabel,
    standingDescription,
    subjectBreakdown,
    history,
    allHistory,
  } = data

  const todayDate = new Date().toISOString().split('T')[0]

  const isShortage = overallPct !== null && overallPct < 75
  const isDetained = studentProfile.accountStatus === 'detained'

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Academic Profile Header Strip */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-black font-mono shadow-md shadow-blue-500/20 flex-shrink-0">
            {studentProfile.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {studentProfile.fullName}
              </h1>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                {studentProfile.rollNo}
              </span>
              {isDetained ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  Account Detained
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Enrollment
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-gray-700">{studentProfile.branchName}</span>
              <span>•</span>
              <span className="font-bold text-gray-800">B.Tech {studentProfile.semester}</span>
              <span>•</span>
              <span>Section {studentProfile.sectionName}</span>
              <span>•</span>
              <span>{studentProfile.academicYear}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Link
            href="/history"
            className="btn-secondary text-xs py-2 px-3.5 rounded-xl shadow-xs"
          >
            Attendance Logs
          </Link>
          <Link
            href="/student/slip"
            className="btn-primary text-xs py-2 px-3.5 rounded-xl shadow-sm"
          >
            Download Slip
          </Link>
        </div>
      </div>

      {/* 2. Main Attendance Analytics & Standing Card */}
      <div className="w-full glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold mb-1 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              Official Attendance Standing
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Cumulative Academic Aggregate</h2>
            <p className="text-xs text-gray-500 mt-0.5">{standingDescription}</p>
          </div>

          {/* Standing Pill */}
          <div
            className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 self-start sm:self-auto shadow-xs ${
              standingTier === 'good'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : standingTier === 'condonation'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                standingTier === 'good'
                  ? 'bg-emerald-500'
                  : standingTier === 'condonation'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-xs tracking-wide uppercase">{standingLabel}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          {/* Main Percentage Display */}
          <div className="bg-gradient-to-b from-white to-slate-50 border border-slate-200/90 rounded-2xl p-5 text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider mb-1">
              Cumulative %
            </span>
            <span
              className={`text-4xl font-extrabold font-mono tracking-tight block ${
                overallPct === null
                  ? 'text-gray-400'
                  : isShortage
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {overallDisplayPct}
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">
              Required: 75.0%
            </span>
          </div>

          {/* Period Statistics Strip */}
          <div className="sm:col-span-3 grid grid-cols-3 gap-3">
            <div className="card-surface p-4 text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Conducted
              </span>
              <span className="text-2xl font-bold font-mono text-gray-900 mt-1 block">
                {totalHeld}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Total periods</span>
            </div>

            <div className="card-surface p-4 text-center bg-emerald-50/50 border-emerald-200/60">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                Attended
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
                {totalAttended}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">Present marks</span>
            </div>

            <div className="card-surface p-4 text-center bg-rose-50/50 border-rose-200/60">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                Missed
              </span>
              <span className="text-2xl font-bold font-mono text-rose-700 mt-1 block">
                {totalMissed}
              </span>
              <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">Absences</span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Regulatory Note */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span className="text-gray-600">Threshold Target (Autonomous / JNTUH Regulation)</span>
            <span className="text-gray-900 font-mono">
              {overallPct !== null ? `${overallPct}% / 75.0% Minimum Cutoff` : 'No classes marked'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                overallPct === null
                  ? 'bg-gray-300'
                  : isShortage
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, overallPct || 0))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 3. Class Weekly Timetable Widget */}
      <StudentTimetableWidget />

      {/* 4. Day-by-Day, Single Day Period Inspector & Date Range Filter */}
      <StudentDayAttendanceInspector
        allHistory={allHistory}
        subjectBreakdown={subjectBreakdown}
        todayDate={todayDate}
      />

      {/* 5. Course-Wise Breakdown Table */}
      <div className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Registered Course Attendance</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Individual course thresholds required for sessional &amp; internal assessments</p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {subjectBreakdown.length} Enrolled Courses
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Course Code</th>
                <th className="px-6 py-3.5 font-semibold">Subject Title</th>
                <th className="px-6 py-3.5 font-semibold text-center">Conducted</th>
                <th className="px-6 py-3.5 font-semibold text-center">Attended</th>
                <th className="px-6 py-3.5 font-semibold w-48">Progress Meter</th>
                <th className="px-6 py-3.5 font-semibold text-right">Percentage</th>
                <th className="px-6 py-3.5 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {subjectBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No classes have been marked yet for your enrolled section.
                  </td>
                </tr>
              ) : (
                subjectBreakdown.map((sub) => {
                  const pct = sub.attendancePct ?? 0
                  return (
                    <tr key={sub.subjectId} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">
                        {sub.subjectCode}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {sub.subjectName}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-gray-600">
                        {sub.periodsHeld}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-emerald-600">
                        {sub.periodsAttended}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              sub.attendancePct === null
                                ? 'bg-gray-300'
                                : sub.isShortage
                                ? 'bg-rose-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                        {sub.displayPct}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sub.attendancePct === null ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Pending
                          </span>
                        ) : sub.isShortage ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Shortage
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Eligible
                          </span>
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

      {/* 5. Recent Attendance Log Timeline */}
      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Recent Attendance Activity</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Chronological record of recently marked periods</p>
          </div>
          <Link href="/history" className="text-xs font-semibold text-blue-600 hover:underline">
            View All Records &rarr;
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            No recent attendance activity recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {history.map((record) => {
              const isPresent = record.status === 'present'
              return (
                <div
                  key={record.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-mono text-gray-500 block">
                      {record.sessionDate || 'Today'} • Period {record.periodNumber || 1}
                    </span>
                    <span className="text-xs font-bold text-gray-900 block truncate max-w-[160px]">
                      {record.subjectName}
                    </span>
                    <span className="text-[10px] font-mono text-blue-600">
                      {record.subjectCode}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      isPresent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isPresent ? 'Present' : 'Absent'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
