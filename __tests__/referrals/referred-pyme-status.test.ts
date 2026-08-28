import { describe, expect, test } from 'bun:test'
import { getReferredPymeStatus } from '@/lib/referrals/referred-pyme-status'

describe('getReferredPymeStatus', () => {
  test('returns invited when no profile is linked', () => {
    expect(getReferredPymeStatus(null, 0)).toBe('invited')
    expect(getReferredPymeStatus({ id: null }, 0)).toBe('invited')
  })

  test('returns account_created when user_type is unset', () => {
    expect(getReferredPymeStatus({ id: 'p1', user_type: null }, 0)).toBe('account_created')
  })

  test('returns onboarding_incomplete for non-pyme or missing fields', () => {
    expect(
      getReferredPymeStatus({ id: 'p1', user_type: 'investor', company_name: 'A', country: 'MX', sector: 'tech' }, 0),
    ).toBe('onboarding_incomplete')
    expect(getReferredPymeStatus({ id: 'p1', user_type: 'pyme', company_name: 'A' }, 0)).toBe(
      'onboarding_incomplete',
    )
  })

  test('returns inactive for onboarded pyme without deals', () => {
    expect(
      getReferredPymeStatus(
        { id: 'p1', user_type: 'pyme', company_name: 'A', country: 'MX', sector: 'tech' },
        0,
      ),
    ).toBe('inactive')
  })

  test('returns active when pyme has deals', () => {
    expect(
      getReferredPymeStatus(
        { id: 'p1', user_type: 'pyme', company_name: 'A', country: 'MX', sector: 'tech' },
        2,
      ),
    ).toBe('active')
  })
})
