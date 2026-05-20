'use client'

import { Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/provider'

type SettingsStakeCardProps = {
  stakeAmount: string
  onStakeChange: (value: string) => void
  isSaving: boolean
  onSave: () => void
}

export function SettingsStakeCard({ stakeAmount, onStakeChange, isSaving, onSave }: SettingsStakeCardProps) {
  const { t } = useI18n()

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <Shield className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold leading-snug">{t('settings.trustTitle')}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.trustDescription')}</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stake_amount">{t('settings.stakeLabel')}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="stake_amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={stakeAmount}
            onChange={(e) => onStakeChange(e.target.value)}
            placeholder="0"
          />
          <Button type="button" variant="outline" className="rounded-full sm:shrink-0" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t('common.saving')}
              </>
            ) : (
              t('settings.saveStake')
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.stakeHint')}</p>
      </div>
    </div>
  )
}
