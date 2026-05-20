'use client'

import { Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { localizedUserType } from '@/components/navigation/user-avatar'
import { useI18n } from '@/lib/i18n/provider'

type SettingsAccountCardProps = {
  email: string
  userType: string
}

export function SettingsAccountCard({ email, userType }: SettingsAccountCardProps) {
  const { t } = useI18n()

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {t('settings.sectionAccount')}
      </h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {t('settings.accountEmail')}
          </dt>
          <dd className="mt-1 truncate text-sm font-medium">{email}</dd>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.emailLockedHint')}</p>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t('settings.userTypeLabel')}</dt>
          <dd className="mt-1.5">
            <Badge variant="secondary">{localizedUserType(userType, t)}</Badge>
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.userTypeLockedHint')}</p>
        </div>
      </dl>
    </div>
  )
}
