import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RWA_DOCUMENT_DOMAIN,
  RWA_FEE_FIELDS,
  RWA_SNAPSHOT_DOMAIN,
  RWA_SNAPSHOT_FIELDS,
  RWA_SNAPSHOT_VERSION,
  buildDocumentCommitment,
  buildFinancialSnapshot,
  canonicalizeRwaValue,
  hashDocumentCommitment,
  hashFinancialSnapshot,
  hashRwaCommitment,
  toAtomicString,
  unitsForContribution,
} from '@/lib/rwa/commitment'

const FIXTURE_DIR = join(import.meta.dir, 'fixtures', 'snapshot-v1')
const HEX64 = /^[0-9a-f]{64}$/

function readFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as {
    spec: string
    domain: string
    payload: Record<string, unknown>
    expected_canonical: string
    expected_hash: string
  }
}

const base = readFixture('base.json')
const reordered = readFixture('reordered-input.json')
const termsChanged = readFixture('terms-changed.json')
const feesChanged = readFixture('fees-changed.json')
const documentVector = readFixture('document.json')

const baseSnapshot = buildFinancialSnapshot(base.payload as never)

describe('canonical encoding', () => {
  test('sorts keys and emits no whitespace', () => {
    const canonical = canonicalizeRwaValue({ b: 1, a: 'x', c: { z: true, y: null } })
    expect(canonical).toBe('{"a":"x","b":1,"c":{"y":null,"z":true}}')
    expect(canonical).not.toContain(' ')
    expect(canonical).not.toContain('\n')
  })

  test('reproduces the frozen canonical bytes for the base vector', () => {
    expect(canonicalizeRwaValue(baseSnapshot)).toBe(base.expected_canonical)
  })

  test('accepts integers and strings but rejects floats', () => {
    expect(canonicalizeRwaValue({ amount: '2500' })).toBe('{"amount":"2500"}')
    expect(canonicalizeRwaValue({ term_days: 60 })).toBe('{"term_days":60}')
    expect(() => canonicalizeRwaValue({ amount: 1.5 })).toThrow('floats are not allowed')
    expect(() => canonicalizeRwaValue({ amount: Number.NaN })).toThrow('non-finite')
  })

  test('is domain separated', () => {
    expect(hashRwaCommitment(RWA_SNAPSHOT_DOMAIN, baseSnapshot)).not.toBe(
      hashRwaCommitment(RWA_DOCUMENT_DOMAIN, baseSnapshot),
    )
    expect(() => hashRwaCommitment('', baseSnapshot)).toThrow('domain is required')
  })
})

describe('financial snapshot vectors', () => {
  test('snapshot version is pinned to the fixture spec', () => {
    expect(base.spec).toBe('rwa-financial-snapshot-v1')
    expect(RWA_SNAPSHOT_VERSION).toBe(1)
    expect(baseSnapshot.snapshot_version).toBe(1)
  })

  test('base vector hashes to its frozen digest', () => {
    expect(hashFinancialSnapshot(baseSnapshot)).toBe(base.expected_hash)
    expect(base.expected_hash).toMatch(HEX64)
  })

  test('reordered input produces an identical digest', () => {
    const reorderedSnapshot = buildFinancialSnapshot(reordered.payload as never)
    expect(reordered.expected_hash).toBe(base.expected_hash)
    expect(hashFinancialSnapshot(reorderedSnapshot)).toBe(base.expected_hash)
  })

  test('a changed frozen term changes the digest', () => {
    const changed = buildFinancialSnapshot(termsChanged.payload as never)
    expect(hashFinancialSnapshot(changed)).toBe(termsChanged.expected_hash)
    expect(termsChanged.expected_hash).not.toBe(base.expected_hash)
  })

  test('a changed fee changes the digest', () => {
    const changed = buildFinancialSnapshot(feesChanged.payload as never)
    expect(hashFinancialSnapshot(changed)).toBe(feesChanged.expected_hash)
    expect(feesChanged.expected_hash).not.toBe(base.expected_hash)
  })

  test('covers principal, asset identity, return, term, maturity and fees', () => {
    for (const field of RWA_SNAPSHOT_FIELDS) {
      expect(Object.keys(baseSnapshot)).toContain(field)
    }
    expect(RWA_SNAPSHOT_FIELDS).toEqual([
      'snapshot_version',
      'deal_id',
      'network',
      'asset_code',
      'asset_issuer',
      'asset_decimals',
      'principal_atomic',
      'return_numerator',
      'return_denominator',
      'display_yield_bps',
      'term_days',
      'maturity_policy',
      'fees',
      'issued_at',
      'issuance_identity',
    ])
    expect(typeof baseSnapshot.principal_atomic).toBe('string')
    expect(baseSnapshot.maturity_policy).toBe('delivery_relative')
    expect(Object.keys(baseSnapshot.fees)).toEqual(expect.arrayContaining([...RWA_FEE_FIELDS]))
    expect(baseSnapshot.fees.rounding_policy).toBe('half_up_atomic')
    expect(baseSnapshot.fees.charged_at).toBe('funding')
  })
})

describe('snapshot validation', () => {
  const valid = base.payload as never

  test('rejects a float or negative principal', () => {
    expect(() => buildFinancialSnapshot({ ...valid, principal_atomic: '2500.5' })).toThrow(
      'principal_atomic must be a decimal integer string',
    )
    expect(() => buildFinancialSnapshot({ ...valid, principal_atomic: '-1' })).toThrow(
      'non-negative',
    )
  })

  test('rejects an unknown maturity policy', () => {
    expect(() =>
      buildFinancialSnapshot({ ...valid, maturity_policy: 'fixed_absolute' }),
    ).toThrow('maturity_policy must be delivery_relative')
  })

  test('rejects a return numerator at or above the denominator', () => {
    expect(() =>
      buildFinancialSnapshot({ ...valid, return_numerator: '100000000' }),
    ).toThrow('return_numerator must be smaller')
  })

  test('rejects a snapshot version that is not current', () => {
    expect(() => buildFinancialSnapshot({ ...valid, snapshot_version: 2 })).toThrow(
      'snapshot_version must be 1',
    )
  })

  test('rejects a timestamp that is not RFC 3339 UTC', () => {
    expect(() => buildFinancialSnapshot({ ...valid, issued_at: '2026-10-20 12:34:56' })).toThrow(
      'issued_at must be RFC 3339 UTC',
    )
  })

  test('rejects a fee block without a rounding policy', () => {
    expect(() =>
      buildFinancialSnapshot({
        ...valid,
        fees: { platform_fee_bps: 100, tw_fee_bps: 30, charged_at: 'funding' },
      }),
    ).toThrow('fees.rounding_policy is required')
  })
})

describe('document commitments', () => {
  test('matches the frozen document vector', () => {
    const payload = documentVector.payload as never
    const document = buildDocumentCommitment(payload)
    expect(hashDocumentCommitment(document)).toBe(documentVector.expected_hash)
    expect(documentVector.expected_hash).toMatch(HEX64)
  })

  test('a changed document changes the digest', () => {
    const payload = documentVector.payload as never
    const changed = buildDocumentCommitment({
      ...payload,
      content_hash: '0'.repeat(64),
    })
    expect(hashDocumentCommitment(changed)).not.toBe(documentVector.expected_hash)
  })

  test('rejects a hash that is not 64 lowercase hex characters', () => {
    const payload = documentVector.payload as never
    expect(() => buildDocumentCommitment({ ...payload, content_hash: 'ABC123' })).toThrow(
      'content_hash must be 64 lowercase hex characters',
    )
  })
})

describe('integer amounts and units', () => {
  test('toAtomicString rejects leading zeros and non-integers', () => {
    expect(toAtomicString('2500', 'amount')).toBe('2500')
    expect(() => toAtomicString('02500', 'amount')).toThrow('decimal integer string')
    expect(() => toAtomicString(12.5, 'amount')).toThrow('non-negative safe integer')
  })

  test('units are exact and never derived from display basis points', () => {
    expect(unitsForContribution(BigInt('25000000000'))).toBe(BigInt('25000000000'))
    expect(unitsForContribution(BigInt('25000000000'), 2)).toBe(BigInt('2500000000000'))
    expect(() => unitsForContribution(BigInt(0))).toThrow('confirmed principal must be positive')
  })
})

describe('specification artifacts agree', () => {
  const root = join(import.meta.dir, '..', '..')
  const adr = readFileSync(join(root, 'doc', 'rwa-architecture.md'), 'utf8')
  const migration = readFileSync(
    join(root, 'supabase', 'migrations', '20261021071817_rwa_credit_assets_and_positions.sql'),
    'utf8',
  )

  test('the ADR documents every hashed snapshot field', () => {
    for (const field of RWA_SNAPSHOT_FIELDS) {
      expect(adr).toContain(field)
    }
    for (const field of RWA_FEE_FIELDS) {
      expect(adr).toContain(field)
    }
    expect(adr).toContain(RWA_SNAPSHOT_DOMAIN)
    expect(adr).toContain(RWA_DOCUMENT_DOMAIN)
  })

  test('the migration stores the frozen snapshot and its hash', () => {
    expect(migration).toContain('financial_snapshot jsonb')
    expect(migration).toContain('financial_snapshot_hash')
    expect(migration).toContain('rwa_credit_assets')
  })
})
