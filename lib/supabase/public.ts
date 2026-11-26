import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let publicClient: SupabaseClient | null = null

/**
 * Cookie-less anon client for public aggregates and marketplace reads.
 * Keeps RLS; does not opt the request into a dynamic cookie boundary.
 */
export function createPublicClient(): SupabaseClient {
  if (publicClient) return publicClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
  publicClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return publicClient
}
