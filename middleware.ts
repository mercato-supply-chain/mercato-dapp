import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'
import { isLocale, localeCookieName } from '@/lib/i18n/config'

export async function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const lang = searchParams.get('lang') || searchParams.get('locale')

  if (lang && isLocale(lang)) {
    request.cookies.set(localeCookieName, lang)
  }

  const response = await updateSession(request)

  if (lang && isLocale(lang)) {
    response.cookies.set(localeCookieName, lang, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
