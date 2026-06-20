import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import type { BlogPost } from '@/lib/blog/types'
import { getBlogLocaleContent } from '@/lib/blog/content'
import type { Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<BlogPost['category'], { en: string; es: string }> = {
  vault: { en: 'Vault guides', es: 'Guías de vault' },
  guides: { en: 'Investor guides', es: 'Guías para inversionistas' },
  platform: { en: 'Platform', es: 'Plataforma' },
}

const AUDIENCE_LABELS: Record<BlogPost['audience'], { en: string; es: string }> = {
  pyme: { en: 'For PyMEs', es: 'Para PyMEs' },
  supplier: { en: 'For Suppliers', es: 'Para proveedores' },
  investor: { en: 'For Investors', es: 'Para inversionistas' },
  all: { en: 'For everyone', es: 'Para todos' },
}

const AUDIENCE_BADGE_CLASSES: Record<BlogPost['audience'], string> = {
  pyme: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  supplier: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  investor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  all: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export function BlogPostCard({ post, locale }: { post: BlogPost; locale: Locale }) {
  const content = getBlogLocaleContent(post, locale)
  const categoryLabel = CATEGORY_LABELS[post.category][locale]
  const audienceLabel = AUDIENCE_LABELS[post.audience][locale]

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
          {categoryLabel}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-medium',
            AUDIENCE_BADGE_CLASSES[post.audience],
          )}
        >
          {audienceLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {post.readingTimeMinutes} min
        </span>
      </div>

      <h2 className="font-display text-xl font-normal tracking-tight sm:text-2xl">
        <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
          {content.title}
        </Link>
      </h2>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{content.excerpt}</p>

      <div className="mt-5 flex items-center justify-between gap-3 pt-2">
        <time dateTime={post.publishedAt} className="text-xs text-muted-foreground">
          {new Date(post.publishedAt).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-sm font-medium text-emerald-700 transition-transform group-hover:translate-x-0.5 dark:text-emerald-300',
          )}
        >
          Read
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </article>
  )
}
