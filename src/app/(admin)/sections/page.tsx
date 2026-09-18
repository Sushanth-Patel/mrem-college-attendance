import { listSections, listBranches } from '@/lib/admin'
import SectionsManager from './SectionsManager'

export default async function SectionsPage() {
  const [sections, branches] = await Promise.all([
    listSections().catch(() => []),
    listBranches().catch(() => []),
  ])

  return (
    <SectionsManager
      initialSections={sections as any}
      branches={branches as any}
    />
  )
}
