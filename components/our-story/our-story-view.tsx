'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Globe,
  Lock,
  Package,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { BlogBreadcrumbs, BlogLayout } from '@/components/blog/blog-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

const ROLE_META = [
  {
    key: 'smb' as const,
    icon: Package,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200/80 dark:border-blue-800/40',
  },
  {
    key: 'investor' as const,
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/80 dark:border-emerald-800/40',
  },
  {
    key: 'supplier' as const,
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200/80 dark:border-amber-800/40',
  },
]

const TRUST_ICONS = [Lock, ShieldCheck, BarChart3, Globe] as const

export function OurStoryView() {
  const { messages } = useI18n()
  const story = messages.ourStory

  const heroPills = [
    { icon: Zap, label: story.hero.pill1 },
    { icon: Lock, label: story.hero.pill2 },
    { icon: Globe, label: story.hero.pill3 },
  ]

  return (
    <BlogLayout>
      <main id="main" tabIndex={-1}>
        <section className="border-b border-border/60 bg-gradient-to-b from-emerald-50/50 via-muted/20 to-transparent dark:from-emerald-950/20">
          <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
            <BlogBreadcrumbs
              items={[{ label: 'Home', href: '/' }, { label: story.hero.eyebrow }]}
            />

            <div className="mx-auto max-w-4xl pt-4 text-center">
            <Badge variant="secondary" className="mb-5 gap-1.5 rounded-full px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {story.hero.eyebrow}
            </Badge>

            <h1 className="font-display mx-auto mb-5 max-w-3xl text-4xl font-normal tracking-tight text-balance sm:text-5xl md:text-[3.25rem] md:leading-[1.08]">
              {story.hero.title}
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {story.hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {heroPills.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </span>
              ))}
            </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 lg:pb-16 lg:pt-12">
        <section className="mb-16">
          <Card className="overflow-hidden border-emerald-500/15 bg-gradient-to-br from-emerald-50/70 via-card to-card shadow-sm dark:from-emerald-950/25">
            <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <blockquote className="font-display text-2xl font-normal leading-snug tracking-tight text-balance sm:text-3xl">
                “{story.mission.quote}”
              </blockquote>
              <div className="rounded-xl border border-border/60 bg-background/70 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {story.mission.statLabel}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                  {story.mission.statValue}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-16 grid gap-6 md:grid-cols-2">
          <ContentBlock title={story.what.title} body={story.what.body} />
          <ContentBlock title={story.why.title} body={story.why.body} accent />
        </section>

        <section className="mb-16">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-3xl font-normal tracking-tight">{story.roles.title}</h2>
            <p className="mt-2 text-muted-foreground">{story.roles.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {ROLE_META.map(({ key, icon: Icon, color, bg, border }) => (
              <div
                key={key}
                className={cn(
                  'rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md',
                  bg,
                  border,
                )}
              >
                <span
                  className={cn(
                    'mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 shadow-sm',
                    color,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-semibold">{story.roles[key].label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {story.roles[key].description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-3xl font-normal tracking-tight">{story.flow.title}</h2>
            <p className="mt-2 text-muted-foreground">{story.flow.subtitle}</p>
          </div>
          <ol className="relative space-y-0">
            {story.flow.steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
                {index < story.flow.steps.length - 1 && (
                  <span
                    className="absolute left-[1.125rem] top-10 h-[calc(100%-2rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-16">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h2 className="font-display text-3xl font-normal tracking-tight">{story.trust.title}</h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
                {story.trust.body}
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {story.trust.points.map((point, index) => {
                  const Icon = TRUST_ICONS[index] ?? ShieldCheck
                  return (
                    <li
                      key={point}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm leading-relaxed">{point}</span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="mb-6 font-display text-3xl font-normal tracking-tight">{story.faq.title}</h2>
          <div className="space-y-3">
            {story.faq.items.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-sm"
              >
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <StoryEndCta />
        </div>
      </main>
    </BlogLayout>
  )
}

function ContentBlock({
  title,
  body,
  accent,
}: {
  title: string
  body: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-7',
        accent && 'border-emerald-500/15 bg-emerald-50/30 dark:bg-emerald-950/15',
      )}
    >
      <h2 className="font-display text-2xl font-normal tracking-tight">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function StoryEndCta() {
  const { messages } = useI18n()
  const cta = messages.ourStory.cta

  return (
    <section
      aria-labelledby="story-end-cta-heading"
      className="rounded-2xl border border-border/70 bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {cta.eyebrow}
          </p>
          <h2
            id="story-end-cta-heading"
            className="font-display text-2xl font-normal tracking-tight text-balance sm:text-3xl"
          >
            {cta.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {cta.description}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 sm:items-end">
          <Button asChild className="h-11 rounded-full bg-emerald-600 px-6 hover:bg-emerald-700">
            <Link href="/auth/sign-up">
              {cta.primaryCta}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/how-it-works">{cta.secondaryCta}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground">
              <Link href="/deals">{cta.tertiaryCta}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
