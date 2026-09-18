import { requireAdmin } from '@/lib/auth/guards'
import { listSections } from '@/lib/admin/sections'
import { formatAcademicTerm } from '@/lib/academic'
import CalendarManager, { type SectionOption } from './CalendarManager'

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

export default async function CalendarPage() {
  await requireAdmin()

  const rows = (await listSections().catch(() => [])) as unknown as SectionRow[]

  const sections: SectionOption[] = rows
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      label: `${row.branches?.code ?? '—'} · Year ${row.year_of_study} · Section ${row.section_name} · ${formatAcademicTerm(row.semester)} ${row.academic_year}`,
    }))

  return <CalendarManager sections={sections} />
}
