import { getDictionary } from '@/lib/i18n/dictionaries'
import { getServerLocale, tr } from '@/lib/i18n/server'

const STEPS = [
  { id: 'order', n: 1, titleKey: 'landing.flow.order.short', actorKey: 'landing.flow.order.actor' },
  { id: 'fund', n: 2, titleKey: 'landing.flow.fund.short', actorKey: 'landing.flow.fund.actor' },
  { id: 'produce', n: 3, titleKey: 'landing.flow.produce.short', actorKey: 'landing.flow.produce.actor' },
  { id: 'complete', n: 4, titleKey: 'landing.flow.complete.short', actorKey: 'landing.flow.complete.actor' },
] as const

export async function HeroHowItWorksSteps() {
  const locale = await getServerLocale()
  const t = await getDictionary(locale)

  return (
    <ol className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4 lg:gap-8">
      {STEPS.map((step, index) => (
        <li key={step.id} className="relative min-w-0">
          {index < STEPS.length - 1 ? (
            <span
              className="pointer-events-none absolute -right-3 top-3 hidden h-px w-6 bg-border lg:block"
              aria-hidden
            />
          ) : null}
          <p className="text-sm tabular-nums text-brand-mid dark:text-brand-light">{step.n}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{tr(t, step.titleKey)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{tr(t, step.actorKey)}</p>
        </li>
      ))}
    </ol>
  )
}
