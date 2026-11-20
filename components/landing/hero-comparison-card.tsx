'use client'

import { useI18nNamespace } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

type ComparisonRow = {
  provider: string
  rate: string
  access: string
  highlight?: boolean
}

export function HeroComparisonCard({ className }: { className?: string }) {
  const { t } = useI18nNamespace('landing')

  const rows: ComparisonRow[] = [
    {
      provider: t('rates.options.bank.label'),
      rate: t('rates.options.bank.rate'),
      access: t('rates.options.bank.requirements'),
    },
    {
      provider: t('rates.options.mercato.label'),
      rate: t('rates.options.mercato.rate'),
      access: t('rates.options.mercato.requirements'),
      highlight: true,
    },
    {
      provider: t('hero.comparison.fintech'),
      rate: t('rates.options.fintech.rate'),
      access: t('rates.options.fintech.requirements'),
    },
    {
      provider: t('hero.comparison.informal'),
      rate: t('rates.options.informal.rate'),
      access: t('rates.options.informal.requirements'),
    },
  ]

  return (
    <aside
      className={cn(
        'hero-comparison-card w-full max-w-[13.5rem] rounded-lg border p-2.5 backdrop-blur-md sm:max-w-[14.5rem]',
        'border-border/50 bg-white/95 shadow-[0_8px_24px_-12px_hsl(var(--brand-dark)/0.12)]',
        'dark:border-white/10 dark:bg-[hsl(0_0%_6%/0.92)] dark:shadow-[0_8px_28px_-14px_hsl(0_0%_0%/0.55)]',
        className,
      )}
      aria-labelledby="hero-comparison-title"
    >
      <h2
        id="hero-comparison-title"
        className="mb-2 font-mono text-[7px] font-semibold uppercase leading-[1.35] tracking-[0.1em] text-muted-foreground dark:text-white/65"
      >
        {t('hero.comparison.title')}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[8px] leading-tight">
          <thead>
            <tr className="border-b border-border/50 text-[6.5px] uppercase tracking-wider text-muted-foreground dark:border-white/[0.08] dark:text-white/45">
              <th className="pb-1 pr-1 font-medium">{t('hero.comparison.colProvider')}</th>
              <th className="pb-1 pr-1 font-medium">{t('hero.comparison.colRate')}</th>
              <th className="pb-1 font-medium">{t('hero.comparison.colAccess')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.provider}
                className={cn(
                  'border-b border-border/40 last:border-0 dark:border-white/[0.04]',
                  row.highlight && 'bg-brand-pale/70 dark:bg-brand-mid/20',
                )}
              >
                <td
                  className={cn(
                    'max-w-[3.25rem] py-1 pr-1 font-medium',
                    row.highlight ? 'text-brand-mid dark:text-brand-light' : 'text-foreground/85 dark:text-white/75',
                  )}
                >
                  <span className="line-clamp-2">{row.provider}</span>
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap py-1 pr-1 tabular-nums',
                    row.highlight
                      ? 'font-semibold text-brand-mid dark:text-brand-light/90'
                      : 'text-muted-foreground dark:text-white/55',
                  )}
                >
                  {row.rate}
                </td>
                <td
                  className={cn(
                    'max-w-[4.5rem] py-1 leading-[1.25]',
                    row.highlight
                      ? 'text-foreground/80 dark:text-white/65'
                      : 'text-muted-foreground dark:text-white/45',
                  )}
                >
                  <span className="line-clamp-2">{row.access}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  )
}
