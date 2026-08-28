import type { ReferralInvitationStatus } from './types'

/**
 * Valid invitations for conversion denominator: created invitations that were
 * not revoked before any conversion. Revoked-without-conversion and expired
 * unused invitations are excluded from the denominator.
 */
export function isValidInvitationForConversion(status: ReferralInvitationStatus): boolean {
  return status === 'active' || status === 'converted' || status === 'expired'
}

export function isInvitationActive(
  status: ReferralInvitationStatus,
  expiresAt: string | null,
  nowMs = Date.now(),
): boolean {
  if (status !== 'active') return false
  if (!expiresAt) return true
  const expiresMs = Date.parse(expiresAt)
  return Number.isFinite(expiresMs) && expiresMs > nowMs
}

export function computeConversionRate(onboarded: number, validInvitations: number): number {
  if (validInvitations <= 0) return 0
  return Math.round((onboarded / validInvitations) * 10000) / 10000
}
