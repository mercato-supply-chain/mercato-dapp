import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isOnboardingUserType, resolveSignupUserType } from '@/lib/profile/onboarding'

const MIGRATION = resolve(
  import.meta.dir,
  '../../supabase/migrations/20260827000100_reject_admin_signup_metadata.sql',
)

describe('resolveSignupUserType', () => {
  test('keeps permitted onboarding roles', () => {
    expect(resolveSignupUserType('pyme')).toBe('pyme')
    expect(resolveSignupUserType('investor')).toBe('investor')
    expect(resolveSignupUserType('supplier')).toBe('supplier')
    expect(isOnboardingUserType('pyme')).toBe(true)
  })

  test('trims whitespace on permitted roles', () => {
    expect(resolveSignupUserType('  investor  ')).toBe('investor')
  })

  test('cannot elevate via attacker-controlled signup metadata', () => {
    expect(resolveSignupUserType('admin')).toBeNull()
    expect(resolveSignupUserType('ADMIN')).toBeNull()
    expect(resolveSignupUserType(' admin ')).toBeNull()
    expect(isOnboardingUserType('admin')).toBe(false)
  })

  test('unknown or empty metadata stays unassigned', () => {
    expect(resolveSignupUserType(null)).toBeNull()
    expect(resolveSignupUserType(undefined)).toBeNull()
    expect(resolveSignupUserType('')).toBeNull()
    expect(resolveSignupUserType('moderator')).toBeNull()
    expect(resolveSignupUserType({ user_type: 'admin' })).toBeNull()
  })
})

describe('handle_new_user migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8')

  test('signup allowlist excludes admin', () => {
    expect(sql).toContain("meta_type in ('pyme', 'investor', 'supplier')")
    expect(sql).not.toContain("meta_type in ('pyme', 'investor', 'supplier', 'admin')")
  })

  test('insert trigger strips admin unless service_role', () => {
    expect(sql).toContain('enforce_profile_insert_privileged_fields')
    expect(sql).toContain("if new.user_type = 'admin' then")
    expect(sql).toContain('new.user_type := null')
  })

  test('authorised provisioning stays on admin_set_user_type', () => {
    expect(sql).toContain('create or replace function public.admin_set_user_type')
    expect(sql).toContain('v_admin uuid := assert_admin()')
    expect(sql).toContain("'set_user_type'")
  })
})
