'use client'

import { useMemo, useState } from 'react'
import { BlogPostCard } from '@/components/blog/blog-post-card'
import type { BlogAudience, BlogPost } from '@/lib/blog/types'
import type { Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

type AudienceFilter = 'all' | 'pyme' | 'supplier' | 'investor'

const ROLE_ORDER: Array<Exclude<AudienceFilter, 'all'>> = ['pyme', 'supplier', 'investor']

export type BlogExplorerCopy = {
  tabs: Record<AudienceFilter, string>
  sections: Record<Exclude<AudienceFilter, 'all'>, { title: string; description: string }>
  empty: string
}

function matchesAudience(post: BlogPost, filter: Exclude<AudienceFilter, 'all'>): boolean {
  // Posts tagged `all` are relevant to every role-specific view.
  return post.audience === filter || post.audience === 'all'
}

export function BlogIndexExplorer({
  posts,
  locale,
  copy,
}: {
  posts: BlogPost[]
  locale: Locale
  copy: BlogExplorerCopy
}) {
  const [activeFilter, setActiveFilter] = useState<AudienceFilter>('all')

  const tabs: AudienceFilter[] = ['all', ...ROLE_ORDER]

  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return posts
    return posts.filter((post) => matchesAudience(post, activeFilter))
  }, [posts, activeFilter])

  return (
    <section>
      <div
        role="tablist"
        aria-label={copy.tabs.all}
        className="mb-8 flex flex-wrap gap-2"
      >
        {tabs.map((tab) => {
          const selected = activeFilter === tab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border/70 bg-card text-muted-foreground hover:border-emerald-600/50 hover:text-foreground',
              )}
            >
              {copy.tabs[tab]}
            </button>
          )
        })}
      </div>

      {activeFilter === 'all' ? (
        <div className="space-y-14">
          {ROLE_ORDER.map((role) => {
            const rolePosts = posts.filter((post) => matchesAudience(post, role))
            if (rolePosts.length === 0) return null
            return (
              <div key={role}>
                <h2 className="mb-2 font-display text-2xl font-normal tracking-tight">
                  {copy.sections[role].title}
                </h2>
                <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
                  {copy.sections[role].description}
                </p>
                <div className="grid gap-5 md:grid-cols-2">
                  {rolePosts.map((post) => (
                    <BlogPostCard key={post.slug} post={post} locale={locale} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredPosts.map((post) => (
            <BlogPostCard key={post.slug} post={post} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      )}
    </section>
  )
}
