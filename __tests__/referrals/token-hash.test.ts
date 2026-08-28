import { describe, expect, test } from 'bun:test'
import { generateInviteToken, hashInviteToken, buildInviteSignupUrl } from '@/lib/referrals/token'

describe('referral token hashing', () => {
  test('hashInviteToken is deterministic SHA-256 hex', () => {
    const token = 'test-token-value'
    const hash = hashInviteToken(token)
    expect(hash).toHaveLength(64)
    expect(hashInviteToken(token)).toBe(hash)
  })

  test('generateInviteToken produces unique opaque values', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(20)
  })

  test('buildInviteSignupUrl encodes token in signup path', () => {
    const url = buildInviteSignupUrl('https://app.example.com', 'abc+/=')
    expect(url).toContain('/auth/sign-up?invite=')
    expect(url).toContain(encodeURIComponent('abc+/='))
  })
})
