import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { IST_TIMEZONE } from '@/lib/timezone'
import TakeAttendanceHub from './TakeAttendanceHub'

export const dynamic = 'force-dynamic'

import { getFacultyAssignedClassCards } from '@/lib/faculty/dashboard'

export default async function TakeAttendancePage() {
  const user = await getCurrentUser().catch(() => null)
  if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
    redirect('/login')
  }

  const supabase = await createClient()
  const todayDate = formatInTimeZone(new Date(), IST_TIMEZONE, 'yyyy-MM-dd')

  const [{ data: branches }, { data: sections }, { data: subjects }, assignedCards] = await Promise.all([
    supabase.from('branches').select('id, name, code').order('name'),
    supabase
      .from('sections')
      .select('id, section_name, year_of_study, semester, academic_year, branch_id, branches(name, code)')
      .eq('is_active', true)
      .order('year_of_study'),
    supabase.from('subjects').select('id, name, code, subject_type').order('name'),
    getFacultyAssignedClassCards().catch(() => []),
  ])

  return (
    <div className="space-y-6 pb-12">
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold mb-2 border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Faculty Attendance Suite
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Take Class Attendance
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Mark student attendance directly for your assigned courses, or request a class allocation from the administrator.
          </p>
        </div>
      </div>

      <TakeAttendanceHub
        assignedCards={assignedCards}
        branches={branches ?? []}
        sections={
          (sections ?? []).map((s) => ({
            ...s,
            branches: Array.isArray(s.branches) ? s.branches[0] : s.branches,
          }))
        }
        subjects={
          (subjects ?? []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            code: sub.code,
            is_lab: sub.subject_type === 'lab',
          }))
        }
        todayDate={todayDate}
      />
    </div>
  )
}
