import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      const referralId = request.cookies.get('mercato-referral')?.value
      if (referralId) {
        response.cookies.set('mercato-referral', referralId, {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        })
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/forgot-password?error=reset_link`)
}
