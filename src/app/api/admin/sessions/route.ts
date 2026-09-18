import { NextResponse, type NextRequest } from 'next/server'
import {
  bulkSetSessionStatusByDate,
  listSessionsForDate,
  setSessionStatus,
  type SessionStatus,
} from '@/lib/admin/sessions'

const ALLOWED: SessionStatus[] = ['scheduled', 'completed', 'cancelled', 'holiday']

function parseStatus(raw: unknown): SessionStatus | null {
  return ALLOWED.includes(raw as SessionStatus) ? (raw as SessionStatus) : null
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const date = params.get('date')
    if (!date) {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }
    const sessions = await listSessionsForDate({
      date,
      sectionId: params.get('sectionId') || null,
    })
    return NextResponse.json({ date, sessions })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Session lookup failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const status = parseStatus(body.status)
    if (!status) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED.join(', ')}` },
        { status: 400 }
      )
    }

    if (body.action === 'set_status') {
      if (!body.sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
      }
      const result = await setSessionStatus(body.sessionId, status, body.reason || undefined)
      return NextResponse.json({ success: true, ...result })
    }

    if (body.action === 'set_status_for_date') {
      if (!body.date) {
        return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
      }
      const result = await bulkSetSessionStatusByDate({
        date: body.date,
        status,
        sectionId: body.sectionId || null,
        reason: body.reason || undefined,
      })
      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Session update failed' },
      { status: 500 }
    )
  }
}
