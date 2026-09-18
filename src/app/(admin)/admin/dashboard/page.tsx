import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

export default async function AdminDashboardPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch summary counts
  const [
    { count: branchesCount },
    { count: sectionsCount },
    { count: studentsCount },
    { count: facultyCount },
    { count: pendingRequestsCount },
    { count: pendingAllocationsCount },
  ] = await Promise.all([
    supabase.from('branches').select('*', { count: 'exact', head: true }),
    supabase.from('sections').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
    supabase.from('faculty').select('*', { count: 'exact', head: true }),
    supabase.from('signup_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('faculty_assignment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  // Fetch recent audit logs (human-readable clean summary)
  const { data: recentLogs } = await supabase
    .from('audit_log')
    .select('id, action, old_value, new_value, performed_at, profiles:performed_by(full_name)')
    .eq('target_table', 'attendance_records')
    .order('performed_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* Top Banner — Minimalist Light Glassmorphism */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-200">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
              Admin Command Center
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">MREM Autonomous</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">College Academic Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Department Structure, Timetables, Faculty Allocations &amp; Student Attendance
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/roster"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            Import Class Data
          </Link>
          <Link
            href="/reports"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
          >
            Attendance Reports
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Link href="/students" className="card-surface-hover p-4 block group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition">
              Students
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{studentsCount ?? 0}</p>
          <span className="text-[10px] text-emerald-700 mt-0.5 block font-semibold group-hover:underline">
            Active Records &rarr;
          </span>
        </Link>

        <div className="card-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty</span>
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{facultyCount ?? 0}</p>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Teaching staff</span>
        </div>

        <Link href="/subject-assignments" className="card-surface-hover p-4 block group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition">
              Allocations
            </span>
            <span className={`w-2 h-2 rounded-full ${(pendingAllocationsCount ?? 0) > 0 ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500'}`}></span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-indigo-700 mt-1">{pendingAllocationsCount ?? 0}</p>
          <span className="text-[10px] text-indigo-600 mt-0.5 block font-semibold group-hover:underline">
            {(pendingAllocationsCount ?? 0) > 0 ? `${pendingAllocationsCount} pending review` : 'All allocated'} &rarr;
          </span>
        </Link>

        <div className="card-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sections</span>
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{sectionsCount ?? 0}</p>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{branchesCount ?? 0} departments</span>
        </div>

        <div className="card-surface p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Signups</span>
            <span className={`w-2 h-2 rounded-full ${(pendingRequestsCount ?? 0) > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-amber-600 mt-1">{pendingRequestsCount ?? 0}</p>
          <Link href="/signup-requests" className="text-[10px] text-amber-700 hover:underline mt-0.5 block font-semibold">
            {(pendingRequestsCount ?? 0) > 0 ? 'Review requests &rarr;' : 'No pending'}
          </Link>
        </div>
      </div>

      {/* Main Focus: Core Tools & Clean Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Focused Core Tools (Important Operations Only) */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Essential Administrative Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Faculty Subject Allocations */}
            <Link
              href="/subject-assignments"
              className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-2xl transition group relative shadow-2xs"
            >
              {(pendingAllocationsCount ?? 0) > 0 && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 rounded-full animate-pulse">
                  {pendingAllocationsCount} pending opt-in
                </span>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900">Faculty Subject Allocations</h3>
              </div>
              <p className="text-xs text-slate-500">
                1-click approve faculty opt-in requests and allocate teachers to timetable classes.
              </p>
            </Link>

            {/* 2. Student Directory */}
            <Link
              href="/students"
              className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-violet-400 rounded-2xl transition group shadow-2xs"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-105 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900">Student Directory</h3>
              </div>
              <p className="text-xs text-slate-500">
                Search students by Roll Number or Name to inspect attendance and academic records.
              </p>
            </Link>

            {/* 3. Detained Students Console */}
            <Link
              href="/detained"
              className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-rose-300 rounded-2xl transition group shadow-2xs"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-105 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900">Attendance Shortage &amp; Detention</h3>
              </div>
              <p className="text-xs text-slate-500">
                Filter students below the mandatory 75% cutoff and process condonation status.
              </p>
            </Link>

            {/* 4. Timetable Builder */}
            <Link
              href="/timetable"
              className="p-5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-2xl transition group shadow-2xs"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-slate-900">Class Timetable Matrix</h3>
              </div>
              <p className="text-xs text-slate-500">
                Configure Day × Period slot schedules for regular theory and 3-period lab blocks.
              </p>
            </Link>
          </div>
        </div>

        {/* Clean Activity Feed (No raw JSON clutter) */}
        <div className="bg-white/95 border border-slate-200 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>🕒</span>
                <span>Recent Attendance Updates</span>
              </h2>
              <Link href="/attendance-history" className="text-[11px] font-bold text-indigo-600 hover:underline">
                View Past Classes
              </Link>
            </div>

            {(!recentLogs || recentLogs.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No recent attendance modifications recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => {
                  const changer = log.profiles as unknown as { full_name: string } | null
                  const dateStr = new Date(log.performed_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const isPresent = log.new_value?.status === 'present'

                  return (
                    <div key={log.id} className="text-xs pb-3 border-b border-slate-100 last:border-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{changer?.full_name ?? 'Faculty Staff'}</span>
                        <span className="text-[10px] font-mono text-slate-400">{dateStr}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Attendance status marked as{' '}
                        <span className={`font-bold font-mono px-1.5 py-0.2 rounded ${
                          isPresent ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isPresent ? 'Present' : 'Absent'}
                        </span>
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Verified Audit Logging</span>
            <span className="text-emerald-600 font-bold">✓ Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
