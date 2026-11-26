import { HeroDealSheet } from '@/components/landing/hero-deal-sheet'
import { getLandingHeroDeal } from '@/lib/landing/get-hero-deal'

/** Keep the live deal query inside its own streaming boundary. */
export async function LandingHeroDeal() {
  const deal = await getLandingHeroDeal()
  return <HeroDealSheet deal={deal} className="w-full" />
}
