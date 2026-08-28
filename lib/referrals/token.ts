import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32

/** Generate a cryptographically random invitation token (raw; store only the hash). */
export function generateInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** SHA-256 hash of invite token for database lookup. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function buildInviteSignupUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/auth/sign-up?invite=${encodeURIComponent(token)}`
}

export function buildLegacyReferralSignupUrl(origin: string, companyId: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/auth/sign-up?ref=${encodeURIComponent(companyId)}`
}
