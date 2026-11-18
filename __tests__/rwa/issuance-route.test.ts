import { describe, expect, test } from 'bun:test'
import {
  allocatePositionNets,
  assetIdForDeal,
  dealHash,
  documentRoot,
  investorCapExceeded,
  SOS_LIFECYCLE,
} from '@/lib/rwa/bindings'
import { buildServicingSchedule } from '@/lib/rwa/position-servicing'

const ACCOUNT_A = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT_B = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

describe('RWA issuance bindings', () => {
  test('uses one asset id for the same deal and registry', () => {
    const first = assetIdForDeal('testnet', 'C'.padEnd(56, 'A'), 'deal-1')
    const second = assetIdForDeal('testnet', 'C'.padEnd(56, 'A'), 'deal-1')
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
    expect(dealHash('deal-1')).not.toBe(first)
  })

  test('document root ignores input order', () => {
    const left = 'a'.repeat(64)
    const right = 'b'.repeat(64)
    expect(documentRoot([right, left])).toBe(documentRoot([left, right]))
  })

  test('caps new investors at two and still allows a top-up', () => {
    expect(investorCapExceeded(2, false)).toBe(true)
    expect(investorCapExceeded(2, true)).toBe(false)
    expect(investorCapExceeded(1, false)).toBe(false)
  })

  test('maps the SOS lifecycle onto the persisted credit-asset states', () => {
    expect(SOS_LIFECYCLE.FUNDED).toBe('fully_funded')
    expect(SOS_LIFECYCLE.REPAYING).toBe('settling')
    expect(SOS_LIFECYCLE.REDEEMED).toBe('settled')
  })
})

describe('position servicing schedule', () => {
  test('gives interest dust to the last position and keeps two receivers', () => {
    const assetId = 'ab'.repeat(32)
    const schedule = buildServicingSchedule({
      assetId,
      assetDecimals: 7,
      interestNumerator: BigInt(1),
      interestDenominator: BigInt(3),
      positions: [
        { id: 'pos-b', wallet: ACCOUNT_B, principalAtomic: BigInt(2) },
        { id: 'pos-a', wallet: ACCOUNT_A, principalAtomic: BigInt(2) },
      ],
    })
    expect(schedule.milestones).toHaveLength(2)
    expect(new Set(schedule.milestones.map((milestone) => milestone.receiver)).size).toBe(2)
    const nets = schedule.milestones.map((milestone) => BigInt(milestone.netAtomic))
    expect(nets.reduce((sum, net) => sum + net, BigInt(0))).toBe(BigInt(5))
  })
})
