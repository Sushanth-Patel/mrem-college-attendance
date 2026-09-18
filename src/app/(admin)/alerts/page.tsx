import { requireAdmin } from '@/lib/auth/guards'
import { listSections } from '@/lib/admin/sections'
import { formatAcademicTerm } from '@/lib/academic'
import AlertsConsole, { type SectionOption } from './AlertsConsole'

export const dynamic = 'force-dynamic'

type SectionRow = {
  id: string
  section_name: string
  year_of_study: number
  semester: string
  academic_year: string
  is_active: boolean
  branches: { code: string } | null
}

export default async function AlertsPage() {
  await requireAdmin()

  const rows = (await listSections().catch(() => [])) as unknown as SectionRow[]

  // Only active sections can be alerted on — a graduated batch has no current
  // defaulters to chase (PRD §3, section lifecycle).
  const sections: SectionOption[] = rows
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      label: `${row.branches?.code ?? '—'} · Year ${row.year_of_study} · Section ${row.section_name} · ${formatAcademicTerm(row.semester)} ${row.academic_year}`,
    }))

  return <AlertsConsole sections={sections} />
}
