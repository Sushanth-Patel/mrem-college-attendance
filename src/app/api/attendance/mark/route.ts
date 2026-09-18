import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertSessionAttendance } from '@/lib/attendance/marking'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCurrentUserOrNull } from '@/lib/auth/session'

const markSchema = z.object({
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
  adminUnlocked: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Guard: only staff accounts may mark attendance. Unauthenticated callers
    // get 401 JSON; students get 403 — never a page redirect from an API route.
    const user = await getCurrentUserOrNull()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (user.role !== 'faculty' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only faculty and admin may mark attendance' }, { status: 403 })
    }

    // Per-user rate limit: a marking save is a human action; 30/minute is
    // far above any real usage but caps scripted abuse.
    const rl = checkRateLimit({
      key: `attendance:mark:${user.id}`,
      maxRequests: 30,
      windowSeconds: 60,
    })
    if (!rl.success) {
      return NextResponse.json(
        { error: `Too many submissions — retry in ${rl.resetInSeconds}s` },
        { status: 429 }
      )
    }

    const parsed = markSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid attendance submission payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { sessionId, records, overwriteConfirmed, reason, adminUnlocked } = parsed.data
    const result = await upsertSessionAttendance({
      sessionId,
      records,
      overwriteConfirmed,
      reason,
      adminUnlocked,
    })

    return NextResponse.json({ success: true, changed: result.changed })
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500
    const conflict =
      err && typeof err === 'object' && 'conflict' in err ? (err.conflict as unknown) : undefined
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to mark attendance',
        ...(conflict ? { conflict } : {}),
      },
      { status: statusCode }
    )
  }
}
