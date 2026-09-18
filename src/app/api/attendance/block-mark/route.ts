import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertBlockAttendance } from '@/lib/attendance/block-marking'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCurrentUserOrNull } from '@/lib/auth/session'

const blockMarkSchema = z.object({
  sessionId: z.string().uuid(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(['present', 'absent']),
      })
    )
    .min(1)
    .max(500),
  overwriteConfirmed: z.boolean().optional().default(false),
  reason: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserOrNull()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (user.role !== 'faculty' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only faculty and admin may mark attendance' }, { status: 403 })
    }

    const rl = checkRateLimit({
      key: `attendance:block-mark:${user.id}`,
      maxRequests: 30,
      windowSeconds: 60,
    })
    if (!rl.success) {
      return NextResponse.json(
        { error: `Too many submissions — retry in ${rl.resetInSeconds}s` },
        { status: 429 }
      )
    }

    const parsed = blockMarkSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid block attendance payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { sessionId, records, overwriteConfirmed, reason } = parsed.data
    const result = await upsertBlockAttendance({ sessionId, records, overwriteConfirmed, reason })

    return NextResponse.json({ success: true, changed: result.changed, sessions: result.sessions })
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500
    const conflict =
      err && typeof err === 'object' && 'conflict' in err ? (err.conflict as unknown) : undefined
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to mark block attendance',
        ...(conflict ? { conflict } : {}),
      },
      { status: statusCode }
    )
  }
}
