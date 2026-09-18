import { NextResponse } from 'next/server'
import { getFreeTierUsageStatus } from '@/lib/free-tier-guard'

export async function GET() {
  const usage = getFreeTierUsageStatus()
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    freeTierGuard: usage,
  })
}
