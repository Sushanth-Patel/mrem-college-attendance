import { getSessionMarkingSheet } from '@/lib/attendance/marking'
import { getLabBlockSessionIds } from '@/lib/attendance/block-marking'
import MarkingSheetClient from './MarkingSheetClient'

type PageProps = {
  params: { sessionId: string }
}

export default async function FacultyMarkingPage({ params }: PageProps) {
  const sessionId = params.sessionId
  const sheetData = await getSessionMarkingSheet(sessionId).catch((err) => {
    return { error: err instanceof Error ? err.message : 'Failed to load marking sheet' }
  })

  if ('error' in sheetData) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12">
        <h2 className="text-lg font-bold text-rose-600 mb-2">Cannot Open Marking Sheet</h2>
        <p className="text-xs text-gray-600 mb-6">{sheetData.error}</p>
        <a
          href="/today"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition inline-block"
        >
          Return to Schedule
        </a>
      </div>
    )
  }

  const blockSessionIds = await getLabBlockSessionIds(sessionId).catch(() => [sessionId])
  const isLabBlock = blockSessionIds.length > 1

  return (
    <MarkingSheetClient
      sessionId={sessionId}
      initialData={sheetData}
      isLabBlock={isLabBlock}
      blockCount={blockSessionIds.length}
    />
  )
}
