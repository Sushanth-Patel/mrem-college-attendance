export function getSupabaseConfig() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim()

  if (!configuredUrl || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    )
  }

  let url: string = configuredUrl
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    // Recover from an accidental JWT-in-URL configuration using only its public project ref.
    if (url?.startsWith('eyJ')) {
      try {
        const payload = JSON.parse(atob(url.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (typeof payload.ref === 'string' && /^[a-z0-9]+$/.test(payload.ref)) {
          url = `https://${payload.ref}.supabase.co`
          parsedUrl = new URL(url)
        } else {
          throw new Error('missing project ref')
        }
      } catch {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.')
      }
    } else {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.')
    }
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be the HTTPS URL of your Supabase project.')
  }

  return { url, anonKey }
}
