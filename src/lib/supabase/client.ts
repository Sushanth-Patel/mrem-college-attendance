import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from '@/lib/supabase/config'

export function createClient() {
  const { url, anonKey: key } = getSupabaseConfig()
  return createBrowserClient(url, key)
}
