import { notFound } from 'next/navigation'
import { EventPage } from '@/components/events/event-page'
import { JsonLd } from '@/components/seo/json-ld'
import { getEventBySlug } from '@/lib/events/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { tr } from '@/lib/i18n/server'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const event = getEventBySlug(slug)
  if (!event) return {}

  const messages = getDictionary(event.defaultLocale)

  return {
    title: tr(messages, event.titleKey),
    description: tr(messages, event.metaDescriptionKey),
    alternates: {
      canonical: `/events/${slug}`,
      languages: {
        es: `/events/${slug}?lang=es`,
        en: `/events/${slug}?lang=en`,
      },
    },
    openGraph: {
      title: tr(messages, event.titleKey),
      description: tr(messages, event.metaDescriptionKey),
      url: `https://mercato.app/events/${slug}`,
      type: 'website',
    },
  }
}

export default async function EventSlugPage({ params }: PageProps) {
  const { slug } = await params
  const event = getEventBySlug(slug)
  if (!event) notFound()

  const messages = getDictionary(event.defaultLocale)
  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: tr(messages, event.titleKey),
    description: tr(messages, event.metaDescriptionKey),
    url: `https://mercato.app/events/${slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MERCATO',
      url: 'https://mercato.app',
    },
  }

  return (
    <>
      <JsonLd data={pageSchema} />
      <EventPage event={event} />
    </>
  )
}
