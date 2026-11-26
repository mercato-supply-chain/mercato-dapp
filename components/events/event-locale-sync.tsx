'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { coerceLocale, localeCookieName, type Locale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'

type EventLocaleSyncProps = {
  defaultLocale: Locale
}

export function EventLocaleSync({ defaultLocale }: EventLocaleSyncProps) {
  const { locale, setLocale } = useI18n()
  const searchParams = useSearchParams()

  useEffect(() => {
    const langParam = searchParams.get('lang') ?? searchParams.get('locale')
    if (langParam && coerceLocale(langParam)) return

    const cookieLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${localeCookieName}=`))
      ?.split('=')[1]

    if (cookieLocale && coerceLocale(cookieLocale)) return
    if (locale !== defaultLocale) setLocale(defaultLocale)
  }, [defaultLocale, locale, searchParams, setLocale])

  return null
}
