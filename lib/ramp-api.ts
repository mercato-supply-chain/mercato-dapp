/**
 * Shared helpers for ramp API routes: auth and anchor resolution.
 */

import { createClient } from '@/lib/supabase/server'
import { getAnchorForProvider, getConfiguredProviders } from '@/lib/anchor-factory'
import type { Anchor } from '@/lib/anchors/types'
import { NextResponse } from 'next/server'

export type AuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }

export type AuthAndAnchorResult =
  | { ok: true; userId: string; email: string; anchor: Anchor }
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

/**
 * Get current user and anchor for the given provider.
 * Provider is chosen by the user in the UI. Returns 401 if not logged in,
 * 400 if provider is missing, 503 if no providers configured or the chosen one is not available.
 */
export async function requireAuthAndAnchor(providerId: string | null): Promise<AuthAndAnchorResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const configured = getConfiguredProviders()
  if (configured.length === 0)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Ramp is not configured' }, { status: 503 }),
    }

  if (!providerId || typeof providerId !== 'string')
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Provider is required. Use ?provider= or body.provider. Available: ' + configured.map((p) => p.id).join(', ') },
        { status: 400 }
      ),
    }

  const anchor = getAnchorForProvider(providerId)
  if (!anchor)
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Provider "${providerId}" is not available. Use one of: ${configured.map((p) => p.id).join(', ')}` },
        { status: 400 }
      ),
    }

  return { ok: true, userId: auth.userId, email: auth.email, anchor }
}
