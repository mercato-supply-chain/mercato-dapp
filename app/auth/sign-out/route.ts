import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseUrlAndAnonKey } from '@/lib/supabase/proxy'

export const dynamic = 'force-dynamic'

/**
 * Server-side sign-out: applies cleared auth cookies to the response so a full page
 * reload does not resurrect the session from stale `sb-*` cookies.
 */
export async function POST(request: NextRequest) {
  try {
    let response = NextResponse.json({ ok: true })

    const { url, anonKey } = getSupabaseUrlAndAnonKey()

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.json({ ok: true })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    })

    await supabase.auth.signOut({ scope: 'global' })

    return response
  } catch (e) {
    console.error('[auth/sign-out] POST failed', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Sign out failed' },
      { status: 500 },
    )
  }
}
