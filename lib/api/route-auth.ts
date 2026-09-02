/**
 * Shared auth helpers for API routes: session check and admin role guard.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }

/** Get current user or 401 response. */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email)
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { ok: true, userId: user.id, email: user.email }
}

/** Authenticated user with `profiles.user_type === 'admin'`, or 401/403. */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profile?.user_type !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return auth
}
