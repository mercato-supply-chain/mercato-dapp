import { getTractionData } from '@/lib/traction/get-traction-data'
import { TractionView } from './traction-view'

export async function generateMetadata() {
  return {
    title: 'Platform Traction | Mercato',
    description: 'Mercato platform traction, registered users, and event leads.',
    robots: { index: false, follow: false },
  }
}

export default async function TractionPage() {
  const { users, leads, eventSlugs, summary } = await getTractionData()

  return (
    <TractionView users={users} leads={leads} eventSlugs={eventSlugs} summary={summary} />
  )
}
