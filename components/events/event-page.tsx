'use client'

import { Suspense } from 'react'
import type { EventConfig } from '@/lib/events/config'
import { EventLocaleSync } from '@/components/events/event-locale-sync'
import { EventHeader } from '@/components/events/event-header'
import { EventHero } from '@/components/events/event-hero'
import { EventProblem } from '@/components/events/event-problem'
import { EventHowItWorks } from '@/components/events/event-how-it-works'
import { EventWhyDifferent } from '@/components/events/event-why-different'
import { EventAudiences } from '@/components/events/event-audiences'
import { EventDiscoveryForm } from '@/components/events/event-discovery-form'
import { EventFooter } from '@/components/events/event-footer'

type EventPageProps = {
  event: EventConfig
}

function EventPageContent({ event }: EventPageProps) {
  return (
    <>
      <EventLocaleSync defaultLocale={event.defaultLocale} />
      <EventHeader />
      <main>
        <EventHero event={event} />
        <EventProblem />
        <EventHowItWorks />
        <EventWhyDifferent />
        <EventAudiences />
        <Suspense fallback={null}>
          <EventDiscoveryForm event={event} />
        </Suspense>
      </main>
      <EventFooter />
    </>
  )
}

export function EventPage({ event }: EventPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={null}>
        <EventPageContent event={event} />
      </Suspense>
    </div>
  )
}
