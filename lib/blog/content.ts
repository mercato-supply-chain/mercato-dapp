import type { Locale } from '@/lib/i18n/config'
import type { BlogLocaleContent, BlogPost } from './types'

/** Spanish posts use `post.es`. Brazilian Portuguese falls back to English until bodies are authored. */
export function getBlogLocaleContent(post: BlogPost, locale: Locale): BlogLocaleContent {
  if (locale === 'es') return post.es
  return post.en
}

export function blogPostUrl(slug: string): string {
  return `/blog/${slug}`
}
