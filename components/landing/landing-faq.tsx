'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageCircleQuestion } from 'lucide-react'

const FAQ_IDS = [
  'whatIsMercato',
  'whoCanUse',
  'howFunded',
  'milestones',
  'investorRisk',
  'supplierPayment',
  'stellar',
  'getStarted',
] as const

export function LandingFaq() {
  const { t } = useI18n()
  const { ref, visible } = useReveal<HTMLElement>(0.12)

  const items = FAQ_IDS.map((id) => ({
    id,
    question: t(`landing.faq.items.${id}.q`),
    answer: t(`landing.faq.items.${id}.a`),
  }))

  return (
    <section
      id="faq"
      ref={ref}
      className="landing-section-anchor border-t border-border/50 bg-brand-ultra/30 py-20 dark:bg-muted/40 md:py-24"
      aria-labelledby="landing-faq-heading"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div
            className={cn(
              'relative isolate mb-10 text-center md:mb-12',
              'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
            )}
          >
            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
              {t('landing.faq.eyebrow')}
            </p>
            <h2
              id="landing-faq-heading"
              className="font-display text-[clamp(1.85rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-tight text-foreground text-balance"
            >
              {t('landing.faq.titlePrefix')}{' '}
              <span className="text-brand-mid dark:text-brand-light">{t('landing.faq.titleAccent')}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {t('landing.faq.description')}
            </p>
          </div>

          <div
            className={cn(
              'transition-all duration-700 delay-100 motion-reduce:transition-none',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
            )}
          >
            <Accordion type="single" collapsible className="space-y-3" defaultValue="whatIsMercato">
              {items.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="overflow-hidden rounded-2xl border border-border/70 bg-background/90 px-5 shadow-sm data-[state=open]:border-brand-light/40 data-[state=open]:shadow-md dark:bg-card/80"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline [&[data-state=open]]:text-brand-mid dark:[&[data-state=open]]:text-brand-light">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                variant="outline"
                asChild
                className="rounded-full border-brand-mid/30 px-6 font-semibold text-brand-mid hover:bg-brand-pale/80 dark:text-brand-light"
              >
                <Link href="/how-it-works">
                  {t('landing.faq.walkthroughCta')}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                className="rounded-full bg-brand-mid px-6 font-semibold text-white shadow-glow-brand hover:bg-brand-dark"
              >
                <Link href="/auth/sign-up">{t('landing.faq.signUpCta')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
