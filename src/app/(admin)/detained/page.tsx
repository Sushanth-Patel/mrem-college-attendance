import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getDetainedStudentsList } from '@/lib/admin/detained'
import DetainedStudentsManager from './DetainedStudentsManager'

export const dynamic = 'force-dynamic'

export default async function DetainedStudentsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [students, { data: branches }, { data: sections }] = await Promise.all([
    getDetainedStudentsList({ status: 'all' }),
    supabase.from('branches').select('id, name, code').order('name'),
    supabase
      .from('sections')
      .select('id, section_name, year_of_study, branch_id')
      .eq('is_active', true)
      .order('year_of_study'),
  ])

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-semibold mb-2 border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            Academic Eligibility Governance
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Detained Students Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track student shortages (&lt;75%), review medical condonation requests, and manage attendance exclusions.
          </p>
        </div>
      </div>

      <DetainedStudentsManager
        initialStudents={students}
        branches={branches ?? []}
        sections={sections ?? []}
      />
    </div>
  )
}
