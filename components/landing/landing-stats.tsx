import { HeroStatsBar } from '@/components/landing/hero-stats-bar'
import { getLandingPlatformStats } from '@/lib/landing/get-platform-stats'

/** Only the stats slot waits for the shared aggregate; the hero can stream first. */
export async function LandingStats() {
  const stats = await getLandingPlatformStats()
  return <HeroStatsBar stats={stats} />
}
