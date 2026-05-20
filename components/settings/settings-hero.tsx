'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserAvatar, localizedUserType } from '@/components/navigation/user-avatar'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

type SettingsHeroProps = {
  displayName: string
  email: string
  userType: string
  companyName?: string | null
}

export function SettingsHero({ displayName, email, userType, companyName }: SettingsHeroProps) {
  const { t } = useI18n()
  const theme = getRoleTheme(userType)
  const roleLabel = localizedUserType(userType, t)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br px-6 py-7 shadow-sm md:px-8',
        theme.header,
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-light/10 blur-3xl dark:bg-brand-light/5"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <UserAvatar name={displayName} userType={userType} size="md" className="h-14 w-14 text-base" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t('settings.hubLabel')}
            </p>
            <h1 className="mt-1 font-display text-3xl font-normal leading-tight tracking-tight md:text-4xl">
              {displayName}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('gap-1.5 font-semibold ring-1', theme.badge)}>
                {theme.icon}
                {roleLabel}
              </Badge>
              {companyName && (
                <span className="rounded-full border border-border/70 bg-card/80 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {companyName}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" asChild className="shrink-0 rounded-full">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {t('settings.backDashboard')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
