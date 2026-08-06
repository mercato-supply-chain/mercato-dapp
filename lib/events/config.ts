import type { Locale } from '@/lib/i18n/config'

export type EventConfig = {
  slug: string
  defaultLocale: Locale
  titleKey: string
  metaDescriptionKey: string
  defaultCountry?: string
  active: boolean
}

export const EVENTS: EventConfig[] = [
  {
    slug: 'meetup-argentina',
    defaultLocale: 'es',
    titleKey: 'events.meetupArgentina.metaTitle',
    metaDescriptionKey: 'events.meetupArgentina.metaDescription',
    defaultCountry: 'Argentina',
    active: true,
  },
]

export function getEventBySlug(slug: string): EventConfig | undefined {
  return EVENTS.find((event) => event.slug === slug && event.active)
}

export function getActiveEventSlugs(): string[] {
  return EVENTS.filter((event) => event.active).map((event) => event.slug)
}
