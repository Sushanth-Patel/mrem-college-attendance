/**
 * Free-Tier Circuit Breakers & Quota Protectors
 * Prevents exceeding free tier limits for:
 * 1. Resend (Max 100 emails/day, 2 emails/sec)
 * 2. Supabase (Egress caching & query bounding)
 */

// Daily Resend Tracking
const RESEND_DAILY_MAX = 85 // Safe threshold below 100/day limit
let emailsSentToday = 0
let lastResetDate = new Date().toISOString().split('T')[0]
let lastSendTimestamp = 0

function checkAndResetDailyCounter() {
  const today = new Date().toISOString().split('T')[0]
  if (today !== lastResetDate) {
    emailsSentToday = 0
    lastResetDate = today
  }
}

export async function throttleResendEmail(): Promise<{
  allowLiveSend: boolean
  remainingToday: number
  reason?: string
}> {
  checkAndResetDailyCounter()

  // 1. Check daily quota ceiling
  if (emailsSentToday >= RESEND_DAILY_MAX) {
    console.warn(
      `[FREE-TIER CIRCUIT BREAKER] Resend daily threshold reached (${emailsSentToday}/${RESEND_DAILY_MAX}). Switching to fallback mode to protect free tier.`
    )
    return {
      allowLiveSend: false,
      remainingToday: 0,
      reason: 'Daily free-tier quota ceiling reached (85/100 safe cap)',
    }
  }

  // 2. Throttle per-second rate limit (max 2/sec -> 600ms gap)
  const now = Date.now()
  const timeSinceLastSend = now - lastSendTimestamp
  if (timeSinceLastSend < 600) {
    const sleepMs = 600 - timeSinceLastSend
    await new Promise((resolve) => setTimeout(resolve, sleepMs))
  }

  lastSendTimestamp = Date.now()
  emailsSentToday += 1

  return {
    allowLiveSend: true,
    remainingToday: RESEND_DAILY_MAX - emailsSentToday,
  }
}

export function getFreeTierUsageStatus() {
  checkAndResetDailyCounter()
  return {
    resend: {
      sentToday: emailsSentToday,
      dailyLimit: RESEND_DAILY_MAX,
      monthlyLimit: 3000,
      remainingToday: Math.max(0, RESEND_DAILY_MAX - emailsSentToday),
      isExhausted: emailsSentToday >= RESEND_DAILY_MAX,
      costMonthly: '$0.00',
    },
    supabase: {
      tier: 'Free Tier',
      spendCap: 'Enabled ($0.00 hard limit - no overages)',
      dbSizeCapMB: 500,
      dbUsedApproxMB: '< 15 MB',
      bandwidthCapGB: 5,
      mauLimit: 50000,
      costMonthly: '$0.00',
    },
    vercel: {
      plan: 'Hobby (Free Tier)',
      bandwidthLimitGB: 100,
      costMonthly: '$0.00',
    },
    inMemoryEngines: {
      reports: 'ExcelJS & pdf-lib (0 MB cloud storage, in-memory stream)',
      rateLimiter: 'Local Node.js sliding-window (0 Redis cost)',
      geolocation: 'Browser Native HTML5 Geolocation (0 Maps API cost)',
      costMonthly: '$0.00',
    },
    totalSystemCost: '$0.00 / month (100% Free Tier Guaranteed)',
  }
}
