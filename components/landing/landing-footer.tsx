'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MercatoLogo } from '@/components/mercato-logo'
import { useI18n } from '@/lib/i18n/provider'
import {
  landingSectionHref,
  PUBLIC_NAV_LINKS,
} from '@/lib/navigation/landing-nav'
import { ArrowUpRight } from 'lucide-react'

export function LandingFooter() {
  const { t } = useI18n()
  const pathname = usePathname()
  const onHome = pathname === '/'

  const handleHashClick = (href: string) => {
    if (onHome && href.startsWith('#') && window.location.hash === href) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const footerLinks = {
    [t('landing.footer.exploreTitle')]: PUBLIC_NAV_LINKS.map(({ sectionId, labelKey }) => ({
      label: t(labelKey),
      href: landingSectionHref(sectionId, onHome),
    })),
    [t('landing.footer.learnTitle')]: [
      { label: t('landing.footer.blog'), href: '/blog' },
      { label: t('landing.footer.howItWorksPage'), href: '/how-it-works' },
      { label: t('landing.footer.ourStory'), href: '/our-story' },
    ],
    [t('landing.footer.getStartedTitle')]: [
      { label: t('landing.footer.browseDeals'), href: '/deals' },
      { label: t('landing.footer.createAccount'), href: '/auth/sign-up' },
      { label: t('landing.footer.signIn'), href: '/auth/login' },
    ],
  }

  return (
    <footer className="border-t border-border/60 bg-gradient-to-b from-brand-ultra/40 to-background dark:from-background">
      <div className="container mx-auto px-4 py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 md:gap-8">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
              <MercatoLogo className="h-6" />
              <span className="font-display text-xl tracking-tight text-foreground">MERCATO</span>
            </Link>
            <p className="mb-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t('landing.footer.tagline')}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand-mid/80">
              {t('landing.footer.builtOn')}
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
                {title}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-brand-mid dark:hover:text-brand-light"
                      onClick={() => handleHashClick(link.href)}
                    >
                      {link.label}
                      <ArrowUpRight
                        className="h-3.5 w-3.5 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-muted-foreground">{t('landing.footer.copyright')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Stellar
            </a>
            <span className="hidden text-border sm:inline" aria-hidden>
              ·
            </span>
            <a
              href="https://trustlesswork.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Trustless Work
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
