'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMounted } from '@/hooks/use-mounted'
import { useI18n } from '@/lib/i18n/provider'
import { locales, type Locale } from '@/lib/i18n/config'

const localeShort: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
  'pt-BR': 'PT-BR',
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const mounted = useMounted()

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-2"
      aria-label={t('locale.label')}
      type="button"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="text-xs font-semibold">{localeShort[locale]}</span>
    </Button>
  )

  if (!mounted) {
    return trigger
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('locale.label')}</DropdownMenuLabel>
        {locales.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => setLocale(option)}
            className="cursor-pointer"
          >
            <span className="mr-2 text-xs font-semibold text-muted-foreground">
              {localeShort[option]}
            </span>
            {t(`locale.${option}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
