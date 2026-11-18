import { createHash } from 'node:crypto'

/** Product cap for the first multi-investor release. The schema allows more. */
export const RWA_MAX_INVESTORS = 2

/** SOS names mapped onto the states this repo actually persists. */
export const SOS_LIFECYCLE = {
  FUNDED: 'fully_funded',
  ACTIVE: 'active',
  REPAYING: 'settling',
  REPAID: 'settled',
  REDEEMED: 'settled',
} as const

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Stable deal binding stored on the registry asset. */
export function dealHash(dealId: string): string {
  return sha256Hex(dealId.trim())
}

/**
 * Deterministic asset id for one deal on one registry.
 * Re-preparing issuance for the same deal returns the same id.
 */
export function assetIdForDeal(network: string, registryContract: string, dealId: string): string {
  return sha256Hex(
    `mercato.rwa.asset.v1\n${network}:${registryContract}:${dealId.trim()}`,
  )
}

/** Root over the sorted document content hashes. */
export function documentRoot(contentHashes: readonly string[]): string {
  const sorted = [...contentHashes].map((hash) => hash.trim().toLowerCase()).sort()
  return sha256Hex(sorted.join('\n'))
}

/**
 * Reject a new investor once the product cap is reached.
 * An existing investor may still top up.
 */
export function investorCapExceeded(positionCount: number, investorAlreadyPositioned: boolean): boolean {
  if (investorAlreadyPositioned) return false
  return positionCount >= RWA_MAX_INVESTORS
}

/**
 * Split contractual interest across positions.
 * Each position receives its floored share; the last position absorbs the dust.
 */
export function allocatePositionNets(
  principals: readonly bigint[],
  interestNumerator: bigint,
  interestDenominator: bigint,
): bigint[] {
  if (principals.length === 0) return []
  if (interestDenominator <= BigInt(0) || interestNumerator < BigInt(0)) {
    throw new Error('invalid interest ratio')
  }
  if (interestNumerator >= interestDenominator) {
    throw new Error('interest ratio must be below 1')
  }
  const total = principals.reduce((sum, principal) => sum + principal, BigInt(0))
  const totalInterest = (total * interestNumerator) / interestDenominator
  let assigned = BigInt(0)
  return principals.map((principal, index) => {
    if (index === principals.length - 1) {
      return principal + (totalInterest - assigned)
    }
    const interest = (principal * interestNumerator) / interestDenominator
    assigned += interest
    return principal + interest
  })
}
