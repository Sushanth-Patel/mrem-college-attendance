/**
 * In-Memory Token Bucket / Sliding Window Rate Limiter
 * Ensures protection against OTP flooding and auth brute-forcing
 * without requiring external Redis infrastructure on free tier.
 */

type RateLimitRecord = {
  count: number
  resetAt: number
}

const tracker = new Map<string, RateLimitRecord>()

// Cleanup stale records periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of tracker.entries()) {
      if (val.resetAt < now) {
        tracker.delete(key)
      }
    }
  }, 60000)
}

export function checkRateLimit(args: {
  key: string
  maxRequests: number
  windowSeconds: number
}): { success: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now()
  const record = tracker.get(args.key)

  if (!record || record.resetAt < now) {
    tracker.set(args.key, {
      count: 1,
      resetAt: now + args.windowSeconds * 1000,
    })
    return {
      success: true,
      remaining: args.maxRequests - 1,
      resetInSeconds: args.windowSeconds,
    }
  }

  if (record.count >= args.maxRequests) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000)
    return {
      success: false,
      remaining: 0,
      resetInSeconds: resetIn,
    }
  }

  record.count += 1
  const resetIn = Math.ceil((record.resetAt - now) / 1000)
  return {
    success: true,
    remaining: args.maxRequests - record.count,
    resetInSeconds: resetIn,
  }
}
