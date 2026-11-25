'use client'

import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/provider'

type FieldRowProps = {
  readonly label: string
  readonly value: string
  readonly overridden?: boolean
  readonly numeric?: boolean
}

export function FieldRow({ label, value, overridden = false, numeric = false }: FieldRowProps) {
  const { t } = useI18n()
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right font-medium${numeric ? ' tabular-nums' : ''}`} title={value}>
        {value}
        {overridden && (
          <Badge className="ml-2 border-transparent bg-amber-500/15 align-middle text-[10px] text-amber-700 dark:text-amber-400">
            {t('repaymentEscrow.common.modified')}
          </Badge>
        )}
      </span>
    </div>
  )
}