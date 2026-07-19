import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'

/**
 * Shape of a milestone entry as returned by the escrow indexer, covering both
 * the modern `flags` object and the legacy top-level `released` boolean.
 */
export type MilestoneFlags = {
  status?: string
  flags?: {
    released?: boolean
    approved?: boolean
    disputed?: boolean
    resolved?: boolean
  }
  released?: boolean
}

/** Returns the milestone at `milestoneIndex` from an indexer escrow, if present. */
export function getMilestone(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number,
): MilestoneFlags | undefined {
  return escrow?.milestones?.[milestoneIndex] as MilestoneFlags | undefined
}

/**
 * A milestone counts as released when either flag variant is set or its
 * status reads `released`/`completed`.
 */
export function isMilestoneReleased(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number,
): boolean {
  const m = getMilestone(escrow, milestoneIndex)
  if (!m) return false
  if (m.flags?.released === true || m.released === true) return true
  const s = (m.status ?? '').toLowerCase()
  return s === 'released' || s === 'completed'
}

/** A milestone counts as approved only via the explicit `flags.approved` flag. */
export function isMilestoneApproved(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number,
): boolean {
  return getMilestone(escrow, milestoneIndex)?.flags?.approved === true
}

/**
 * A milestone counts as disputed when flagged or its status reads `disputed`,
 * unless the dispute has been resolved.
 */
export function isMilestoneDisputed(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number,
): boolean {
  const m = getMilestone(escrow, milestoneIndex)
  if (!m) return false
  if (m.flags?.resolved === true) return false
  if (m.flags?.disputed === true) return true
  return (m.status ?? '').toLowerCase() === 'disputed'
}

/** Release only allowed if all previous milestones are released (order: 0 → 1 → 2 …) */
export function canReleaseMilestoneInOrder(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number,
): boolean {
  if (milestoneIndex === 0) return true
  for (let i = 0; i < milestoneIndex; i++) {
    if (!isMilestoneReleased(escrow, i)) return false
  }
  return true
}
