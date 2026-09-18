import { NextResponse, type NextRequest } from 'next/server'
import {
  createAlertBatch,
  getAlertBatchProgress,
  listAlertBatches,
  previewAlertRecipients,
  sendNextAlerts,
  DEFAULT_THRESHOLD,
} from '@/lib/admin/alerts'

function parseThreshold(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0 || value > 100) return DEFAULT_THRESHOLD
  return value
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const batchId = params.get('batchId')

    if (batchId) {
      const progress = await getAlertBatchProgress(batchId)
      return NextResponse.json({ progress })
    }

    if (params.get('preview') === '1') {
      const preview = await previewAlertRecipients({
        sectionId: params.get('sectionId') || null,
        threshold: parseThreshold(params.get('threshold')),
      })
      return NextResponse.json(preview)
    }

    const batches = await listAlertBatches()
    return NextResponse.json({ batches })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Alert lookup failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'create_batch') {
      const result = await createAlertBatch({
        sectionId: body.sectionId || null,
        threshold: parseThreshold(body.threshold),
      })
      return NextResponse.json({ success: true, ...result })
    }

    if (body.action === 'send_next') {
      if (!body.batchId) {
        return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
      }
      // dryRun defaults to true: an accidental or mis-clicked call must never
      // be what puts mail in 60 students' inboxes. The console has to ask for a
      // live send explicitly.
      const result = await sendNextAlerts({
        batchId: body.batchId,
        count: Number(body.count) || 5,
        dryRun: body.dryRun !== false,
      })
      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Alert operation failed' },
      { status: 500 }
    )
  }
}
