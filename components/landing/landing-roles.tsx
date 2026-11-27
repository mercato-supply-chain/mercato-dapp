import Link from 'next/link'
import { ArrowUpRight, Package, ShoppingBasket, TrendingUp } from 'lucide-react'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { LANDING_SECTION_IDS } from '@/lib/navigation/landing-nav'

const ROLES = [
  { id: 'sme', icon: ShoppingBasket, href: '/auth/sign-up' },
  { id: 'investor', icon: TrendingUp, href: '/deals' },
  { id: 'supplier', icon: Package, href: '/auth/sign-up' },
] as const

export async function LandingRoles() {
  const messages = await getServerDictionary()
  const t = (key: string) => tr(messages, `landing.roles.${key}`)

  return (
    <section
      id={LANDING_SECTION_IDS.roles}
      aria-labelledby="landing-roles-title"
      className="landing-section-anchor border-y border-border bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <h2
          id="landing-roles-title"
          className="mb-8 max-w-[19ch] text-balance font-display text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.04] tracking-tight md:mb-12"
        >
          {t('heading')}
        </h2>

        <ul className="divide-y divide-border border-y border-border">
          {ROLES.map(({ id, icon: Icon, href }) => (
            <li
              key={id}
              className="grid gap-3 py-6 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-5 md:grid-cols-[3rem_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.7fr)] md:items-center md:py-8"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-brand-pale text-brand-dark dark:bg-brand-mid/25 dark:text-brand-light">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="self-center font-display text-2xl tracking-tight lg:text-3xl">
                {t(`${id}.label`)}
              </h3>
              <p className="max-w-[46ch] text-pretty text-base leading-relaxed text-muted-foreground sm:col-start-2 md:col-auto">
                {t(`${id}.body`)}
              </p>
              <Link
                href={href}
                className="inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:col-start-2 md:col-auto md:justify-self-end"
              >
                {t(`${id}.cta`)}
                <ArrowUpRight className="size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
