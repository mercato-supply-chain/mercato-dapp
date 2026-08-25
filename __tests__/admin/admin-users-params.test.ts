import { describe, expect, test } from 'bun:test'
import {
  adminUsersSearchParams,
  parseAdminUsersSearchParams,
  USERS_PAGE_SIZE,
} from '@/lib/admin/get-admin-users'

describe('parseAdminUsersSearchParams', () => {
  test('returns defaults for empty params', () => {
    expect(parseAdminUsersSearchParams({})).toEqual({
      search: null,
      role: null,
      verification: null,
      onboarding: null,
      wallet: null,
      signupFrom: null,
      signupTo: null,
      sort: 'newest',
      page: 1,
      pageSize: USERS_PAGE_SIZE,
    })
  })

  test('accepts valid values and takes the first of repeated params', () => {
    const filters = parseAdminUsersSearchParams({
      q: '  cafetal ',
      role: ['supplier', 'pyme'],
      verification: 'unverified',
      onboarding: 'legacy',
      wallet: 'pollar',
      from: '2026-08-01',
      to: '2026-08-24',
      sort: 'recently_updated',
      page: '3',
    })
    expect(filters.search).toBe('cafetal')
    expect(filters.role).toBe('supplier')
    expect(filters.verification).toBe('unverified')
    expect(filters.onboarding).toBe('legacy')
    expect(filters.wallet).toBe('pollar')
    expect(filters.signupFrom).toBe('2026-08-01')
    expect(filters.signupTo).toBe('2026-08-24')
    expect(filters.sort).toBe('recently_updated')
    expect(filters.page).toBe(3)
  })

  test('drops invalid enum values, dates, and pages', () => {
    const filters = parseAdminUsersSearchParams({
      role: 'superuser',
      verification: 'maybe',
      onboarding: 'started',
      wallet: 'metamask',
      from: '2026-13-99',
      to: 'not-a-date',
      sort: 'alphabetical',
      page: '-2',
      pageSize: '0',
    })
    expect(filters.role).toBeNull()
    expect(filters.verification).toBeNull()
    expect(filters.onboarding).toBeNull()
    expect(filters.wallet).toBeNull()
    expect(filters.signupFrom).toBeNull()
    expect(filters.signupTo).toBeNull()
    expect(filters.sort).toBe('newest')
    expect(filters.page).toBe(1)
    expect(filters.pageSize).toBe(USERS_PAGE_SIZE)
  })

  test('caps oversized page sizes', () => {
    expect(parseAdminUsersSearchParams({ pageSize: '5000' }).pageSize).toBe(100)
  })
})

describe('adminUsersSearchParams', () => {
  test('round-trips through parse', () => {
    const filters = parseAdminUsersSearchParams({
      q: 'granos',
      role: 'supplier',
      verification: 'verified',
      onboarding: 'completed',
      wallet: 'connected',
      from: '2026-01-01',
      to: '2026-06-30',
      sort: 'oldest',
      page: '2',
    })
    const reparsed = parseAdminUsersSearchParams(
      Object.fromEntries(adminUsersSearchParams(filters)),
    )
    expect(reparsed).toEqual(filters)
  })

  test('omits default values from the URL', () => {
    const params = adminUsersSearchParams({ sort: 'newest', page: 1 })
    expect(params.toString()).toBe('')
  })
})
