import { describe, expect, test } from 'bun:test'
import { pickReferralPymePublicFields, REFERRAL_PYME_PUBLIC_FIELDS } from '@/lib/referrals/privacy'

describe('referral privacy allowlist', () => {
  test('only exposes public directory fields', () => {
    const row = {
      id: 'p1',
      company_name: 'Acme',
      email: 'secret@example.com',
      phone: '555',
      address: 'GABC...',
      stellar_public_key: 'G...',
      country: 'MX',
      sector: 'retail',
      user_type: 'pyme',
      verified: true,
    }

    const publicProfile = pickReferralPymePublicFields(row)
    expect('email' in publicProfile).toBe(false)
    expect('phone' in publicProfile).toBe(false)
    expect(publicProfile.company_name).toBe('Acme')
    expect(Object.keys(publicProfile).length).toBe(REFERRAL_PYME_PUBLIC_FIELDS.length)
  })
})
