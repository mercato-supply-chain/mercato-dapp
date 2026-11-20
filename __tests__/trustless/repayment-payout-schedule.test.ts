import { describe, expect, test } from 'bun:test'
import { buildRepaymentPayoutSchedule } from '@/lib/trustless/repayment-payout-schedule'
import { buildRepaymentEscrowDraft } from '@/lib/trustless/repayment-deployment-draft'

const ACCOUNT_A = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT_B = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

function schedule() {
  return buildRepaymentPayoutSchedule({
    totalGrossCents: 30_000,
    tranches: [
      {
        positionRef: 'position-a',
        receiver: ACCOUNT_A,
        grossAmountCents: 10_000,
        netAmountCents: 9_870,
        description: 'Investor A principal',
      },
      {
        positionRef: 'position-b',
        receiver: ACCOUNT_B,
        grossAmountCents: 20_000,
        netAmountCents: 19_740,
      },
    ],
  })
}

describe('buildRepaymentPayoutSchedule', () => {
  test('maps two positions to distinct receivers with exact amounts in stable order', () => {
    const result = schedule()
    expect(result.milestones).toEqual([
      { description: 'Investor A principal', amount: 100, receiver: ACCOUNT_A },
      { description: 'Position position-b payout', amount: 200, receiver: ACCOUNT_B },
    ])
    expect(result.positionRefs).toEqual(['position-a', 'position-b'])
    expect(result.totalGrossCents).toBe(30_000)
    expect(result.totalNetCents).toBe(29_610)
  })

  test('rejects a tampered receiver, amount, or total', () => {
    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 100,
        tranches: [
          {
            positionRef: 'p',
            receiver: 'not-stellar',
            grossAmountCents: 100,
            netAmountCents: 99,
          },
        ],
      }),
    ).toThrow('valid Stellar address')

    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 100,
        tranches: [
          {
            positionRef: 'p',
            receiver: ACCOUNT_A,
            grossAmountCents: 10.5,
            netAmountCents: 10,
          },
        ],
      }),
    ).toThrow('integer number of cents')

    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 101,
        tranches: [
          {
            positionRef: 'p',
            receiver: ACCOUNT_A,
            grossAmountCents: 100,
            netAmountCents: 99,
          },
        ],
      }),
    ).toThrow('does not match the frozen gross total')
  })

  test('rejects duplicate position references', () => {
    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 200,
        tranches: [
          {
            positionRef: 'same',
            receiver: ACCOUNT_A,
            grossAmountCents: 100,
            netAmountCents: 99,
          },
          {
            positionRef: 'same',
            receiver: ACCOUNT_B,
            grossAmountCents: 100,
            netAmountCents: 99,
          },
        ],
      }),
    ).toThrow('Duplicate position reference')
  })

  test('rejects receiver overrides for RWA positions', () => {
    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 100,
        receiverOverride: ACCOUNT_B,
        tranches: [
          {
            positionRef: 'p',
            receiver: ACCOUNT_A,
            grossAmountCents: 100,
            netAmountCents: 99,
          },
        ],
      }),
    ).toThrow('do not support receiver overrides')
  })

  test('rejects net amounts above gross', () => {
    expect(() =>
      buildRepaymentPayoutSchedule({
        totalGrossCents: 100,
        tranches: [
          {
            positionRef: 'p',
            receiver: ACCOUNT_A,
            grossAmountCents: 100,
            netAmountCents: 101,
          },
        ],
      }),
    ).toThrow('cannot exceed')
  })

  test('does not change legacy single-investor draft behavior', () => {
    const draft = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-1',
        productName: 'Legacy',
        principal: 1_000,
        aprPercent: 10,
        termDays: 30,
        investorAddress: ACCOUNT_A,
        signerChannel: ACCOUNT_B,
      },
      {
        network: 'testnet',
        platformAddress: ACCOUNT_B,
        platformFeePercent: 1,
        trustline: { address: ACCOUNT_A, symbol: 'USDC' },
      },
    )
    expect(draft.milestones).toHaveLength(1)
    expect(draft.milestones[0].receiver).toBe(ACCOUNT_A)
  })
})
