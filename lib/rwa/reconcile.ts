import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmContributionIntent, type RwaActor, type RwaDependencies } from '@/lib/rwa/contribution-intent'
import { listOpenContributionAttempts } from '@/lib/rwa/db'
import { issuanceDeps, reconcileOutstandingIssuance } from '@/lib/rwa/issuance'

/**
 * Re-read submitted issuance and contribution transactions.
 * Confirmation goes through the same functions as the original request, so a
 * replay cannot create a second asset or a second position.
 */
export async function reconcileOutstandingRwa(
  deps: RwaDependencies,
  actorId: string,
): Promise<{ issuance: number; contributions: number }> {
  const issuance = await reconcileOutstandingIssuance(issuanceDeps(deps.supabase, actorId))
  const open = await listOpenContributionAttempts(deps.supabase)
  let contributions = 0
  for (const attempt of open) {
    const actor: RwaActor = { userId: attempt.investor_id, email: null }
    try {
      await confirmContributionIntent(deps, actor, {
        attemptId: attempt.attempt_id,
        txHash: attempt.tx_hash,
      })
      contributions += 1
    } catch {
      // Leave the attempt submitted. The next reconcile reads the chain again.
    }
  }
  return { issuance, contributions }
}

export type { SupabaseClient }
