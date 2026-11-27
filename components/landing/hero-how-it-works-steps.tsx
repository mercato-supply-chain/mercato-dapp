import { getServerDictionary, tr } from '@/lib/i18n/server'

const STEPS = ['order', 'fund', 'produce', 'complete'] as const

export async function HeroHowItWorksSteps() {
  const messages = await getServerDictionary()

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12 lg:px-12 lg:py-16">
      <h2 id="landing-flow-title" className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-none tracking-tight">
        {tr(messages, 'landing.hero.flowLink')}
      </h2>

      <ol className="list-none" role="list">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-4 pb-5 last:pb-0 before:absolute before:bottom-0 before:left-[1.0625rem] before:top-9 before:w-0.5 before:bg-[#c1d9c9] last:before:hidden dark:before:bg-[#345444]"
          >
            <span
              className="grid size-9 place-items-center rounded-full bg-brand-pale text-sm font-semibold tabular-nums text-brand-dark dark:bg-[#19362a] dark:text-[#bde8c8]"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-1">
              <h3 className="text-base font-semibold leading-6 tracking-tight sm:text-lg">
                {tr(messages, `landing.flow.${step}.short`)}
              </h3>
              <p className="mt-1 max-w-[54ch] text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {tr(messages, `landing.flow.${step}.summary`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
