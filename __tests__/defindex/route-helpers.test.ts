import { describe, expect, test } from 'bun:test'
import {
  extractUpstreamStatus,
  mapDefindexErrorStatus,
  parseAmounts,
  resolveSlippageBps,
  validateCaller,
} from '@/lib/defindex/route-helpers'

const VALID_ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'

describe('extractUpstreamStatus', () => {
  test('reads a numeric statusCode from an SDK API error body', () => {
    expect(extractUpstreamStatus({ statusCode: 400, error: 'BadRequest' })).toBe(400)
    expect(extractUpstreamStatus({ status: 429 })).toBe(429)
  })

  test('coerces numeric strings', () => {
    expect(extractUpstreamStatus({ statusCode: '404' })).toBe(404)
  })

  test('returns null for non-HTTP-status values or network errors', () => {
    expect(extractUpstreamStatus(new Error('socket hang up'))).toBeNull()
    expect(extractUpstreamStatus({ statusCode: 200 })).toBeNull()
    expect(extractUpstreamStatus(null)).toBeNull()
    expect(extractUpstreamStatus('boom')).toBeNull()
  })
})

describe('mapDefindexErrorStatus', () => {
  test('maps validation errors (400/422) to 400', () => {
    expect(mapDefindexErrorStatus({ statusCode: 400 })).toBe(400)
    expect(mapDefindexErrorStatus({ statusCode: 422 })).toBe(400)
  })

  test('maps rate limiting to 429 by status or message', () => {
    expect(mapDefindexErrorStatus({ statusCode: 429 })).toBe(429)
    expect(mapDefindexErrorStatus({ message: 'Rate limit exceeded' })).toBe(429)
    expect(mapDefindexErrorStatus(new Error('Too Many Requests'))).toBe(429)
  })

  test('surfaces not-found as 404', () => {
    expect(mapDefindexErrorStatus({ statusCode: 404 })).toBe(404)
  })

  test('keeps upstream auth, 5xx, and network failures as 502', () => {
    expect(mapDefindexErrorStatus({ statusCode: 401 })).toBe(502)
    expect(mapDefindexErrorStatus({ statusCode: 403 })).toBe(502)
    expect(mapDefindexErrorStatus({ statusCode: 500 })).toBe(502)
    expect(mapDefindexErrorStatus(new Error('network down'))).toBe(502)
  })
})

describe('resolveSlippageBps', () => {
  test('returns finite numeric values', () => {
    expect(resolveSlippageBps(250)).toBe(250)
    expect(resolveSlippageBps(0)).toBe(0)
  })

  test('falls back to 100 (1%) for missing or invalid values', () => {
    expect(resolveSlippageBps(undefined)).toBe(100)
    expect(resolveSlippageBps('50')).toBe(100)
    expect(resolveSlippageBps(Number.NaN)).toBe(100)
  })

  test('honors a custom fallback', () => {
    expect(resolveSlippageBps(undefined, 50)).toBe(50)
  })
})

describe('parseAmounts', () => {
  test('accepts a non-empty positive array and floors each entry', async () => {
    const result = parseAmounts([1000.9, 2000])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.amounts).toEqual([1000, 2000])
  })

  test('rejects empty, non-array, or non-positive entries with 400', async () => {
    const empty = parseAmounts([])
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.response.status).toBe(400)

    const negative = parseAmounts([100, -5])
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.response.status).toBe(400)

    const notArray = parseAmounts('nope')
    expect(notArray.ok).toBe(false)
  })
})

describe('validateCaller', () => {
  test('accepts a well-formed Stellar account and trims it', () => {
    const result = validateCaller(`  ${VALID_ACCOUNT}  `)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.caller).toBe(VALID_ACCOUNT)
  })

  test('rejects missing or malformed callers with 400', () => {
    const missing = validateCaller(null)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.response.status).toBe(400)

    const malformed = validateCaller('not-an-account')
    expect(malformed.ok).toBe(false)
  })
})
