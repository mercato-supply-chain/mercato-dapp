export type BlogLocaleContent = {
  title: string
  description: string
  excerpt: string
  sections: BlogSection[]
}

export type BlogSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; title?: string; text: string }
  | { type: 'faq'; items: Array<{ question: string; answer: string }> }

export type BlogAudience = 'pyme' | 'supplier' | 'investor' | 'all'

export type BlogPost = {
  slug: string
  publishedAt: string
  updatedAt?: string
  readingTimeMinutes: number
  category: 'vault' | 'guides' | 'platform'
  audience: BlogAudience
  tags: string[]
  en: BlogLocaleContent
  es: BlogLocaleContent
}
