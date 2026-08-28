/** Public directory fields safe to expose on supplier referral dashboards. */
export const REFERRAL_PYME_PUBLIC_FIELDS = [
  'id',
  'company_name',
  'full_name',
  'contact_name',
  'bio',
  'country',
  'sector',
  'user_type',
  'verified',
] as const

export type ReferralPymePublicField = (typeof REFERRAL_PYME_PUBLIC_FIELDS)[number]

export type ReferralPymePublicProfile = Record<ReferralPymePublicField, string | boolean | null>

export function pickReferralPymePublicFields(
  row: Record<string, unknown>,
): ReferralPymePublicProfile {
  const out = {} as ReferralPymePublicProfile
  for (const key of REFERRAL_PYME_PUBLIC_FIELDS) {
    const value = row[key]
    if (typeof value === 'boolean' || value === null) {
      out[key] = value
    } else if (typeof value === 'string') {
      out[key] = value
    } else if (value === undefined) {
      out[key] = null
    } else {
      out[key] = String(value)
    }
  }
  return out
}
