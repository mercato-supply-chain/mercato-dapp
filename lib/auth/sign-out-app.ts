'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Clears Supabase auth: browser session + server cookie headers.
 * Client-only signOut can leave session cookies that survive a full reload; the POST
 * clears chunks the same way as middleware/session refresh.
 */
export async function signOutApp(): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch('/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn('[signOutApp] server sign-out route returned', res.status)
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      console.warn('[signOutApp] server sign-out timed out')
    } else {
      console.warn('[signOutApp] server sign-out Request failed', e)
    }
  } finally {
    clearTimeout(timeout)
  }

  const supabase = createClient()

  try {
    await supabase.auth.signOut({ scope: 'global' })
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (e) {
      console.warn('[signOutApp] client sign-out failed', e)
    }
  }
}
