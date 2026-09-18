import { listSections, listBranches } from '@/lib/admin'
import RosterUploadManager from './RosterUploadManager'

export default async function RosterUploadPage() {
  const [sections, branches] = await Promise.all([
    listSections().catch(() => []),
    listBranches().catch(() => []),
  ])

  return (
    <RosterUploadManager
      sections={sections as any}
      branches={branches as any}
    />
  )
}
