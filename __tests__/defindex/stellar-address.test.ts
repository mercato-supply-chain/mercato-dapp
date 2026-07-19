import { describe, expect, test } from 'bun:test'
import {
  isLikelyStellarAccountId,
  isLikelyStellarContractId,
} from '@/lib/defindex/stellar-address'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

describe('isLikelyStellarAccountId', () => {
  test('accepts a well-formed G address', () => {
    expect(isLikelyStellarAccountId(ACCOUNT)).toBe(true)
  })

  test('rejects contract ids, wrong length, lowercase, and empties', () => {
    expect(isLikelyStellarAccountId(CONTRACT)).toBe(false)
    expect(isLikelyStellarAccountId('GABC')).toBe(false)
    expect(isLikelyStellarAccountId(ACCOUNT.toLowerCase())).toBe(false)
    expect(isLikelyStellarAccountId('')).toBe(false)
    expect(isLikelyStellarAccountId(`${ACCOUNT}EXTRA`)).toBe(false)
  })
})

describe('isLikelyStellarContractId', () => {
  test('accepts a well-formed C address', () => {
    expect(isLikelyStellarContractId(CONTRACT)).toBe(true)
  })

  test('rejects account ids and malformed values', () => {
    expect(isLikelyStellarContractId(ACCOUNT)).toBe(false)
    expect(isLikelyStellarContractId('C123')).toBe(false)
    expect(isLikelyStellarContractId('')).toBe(false)
  })
})
