import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS – use only for trusted server-side operations (e.g. public catalog read).
 * Do not expose this client or the service role key to the client.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for service client')
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
