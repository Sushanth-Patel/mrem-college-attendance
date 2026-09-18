import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim()

  if (!url || !key) {
    return NextResponse.json({ status: 'not_configured' }, { status: 503 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${url}/rest/v1/branches?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      return NextResponse.json({ status: 'unhealthy', code: response.status }, { status: 503 })
    }

    return NextResponse.json({ status: 'healthy' })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'unreachable'
    return NextResponse.json({ status: message }, { status: 503 })
  } finally {
    clearTimeout(timeout)
  }
}
