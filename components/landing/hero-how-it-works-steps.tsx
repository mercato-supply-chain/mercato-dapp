'use client'

import * as React from 'react'
import {
  CheckCircle2,
  FileText,
  Package,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

function heroHowItWorksSteps(_t: (key: string) => string) {
  return [
    { id: 'order', n: 1, icon: FileText, titleKey: 'landing.flow.order.title', bodyKey: 'landing.flow.order.body', badgeKey: 'landing.flow.order.badge' },
    { id: 'fund', n: 2, icon: Wallet, titleKey: 'landing.flow.fund.title', bodyKey: 'landing.flow.fund.body', badgeKey: 'landing.flow.fund.badge' },
    { id: 'produce', n: 3, icon: Package, titleKey: 'landing.flow.produce.title', bodyKey: 'landing.flow.produce.body', badgeKey: 'landing.flow.produce.badge' },
    { id: 'complete', n: 4, icon: RefreshCw, titleKey: 'landing.flow.complete.title', bodyKey: 'landing.flow.complete.body', badgeKey: 'landing.flow.complete.badge' },
  ] as const
}

export function HeroHowItWorksSteps() {
  const { t } = useI18n()
  const steps = React.useMemo(() => heroHowItWorksSteps(t), [t])

  return (
    <div className="grid w-full grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0 dark:divide-white/10">
      {steps.map((step) => {
        const Icon = step.icon
        return (
          <article
            key={step.id}
            className="flex h-full min-h-0 flex-col bg-card px-5 py-4 sm:px-6 md:py-5 dark:bg-[hsl(0_0%_4%)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-mid/20 bg-brand-ultra text-sm font-bold text-brand-mid dark:border-brand-light/25 dark:bg-brand-mid/15 dark:text-brand-light"
                aria-hidden
              >
                {step.n}
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand-mid shadow-sm dark:bg-brand-mid/25 dark:text-brand-light dark:shadow-[0_0_20px_-4px_hsl(var(--brand-light)/0.35)]">
                <Icon className="h-7 w-7 stroke-[1.75]" aria-hidden />
              </span>
            </div>

            <h3 className="mb-1.5 text-[13px] font-semibold leading-snug text-foreground">
              {t(step.titleKey)}
            </h3>
            <p className="mb-3 flex-1 text-[12px] leading-relaxed text-muted-foreground">
              {t(step.bodyKey)}
            </p>

            <span className="mt-auto inline-flex w-fit max-w-full items-center gap-1 self-start rounded-full border border-brand-mid/12 bg-brand-pale/70 px-2 py-0.5 text-[9px] font-medium leading-none text-brand-dark dark:border-brand-light/12 dark:bg-brand-mid/15 dark:text-brand-light">
              <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-brand-mid dark:text-brand-light" aria-hidden />
              <span className="truncate">{t(step.badgeKey)}</span>
            </span>
          </article>
        )
      })}
    </div>
  )
}
