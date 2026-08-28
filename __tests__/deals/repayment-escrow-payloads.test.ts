import { describe, expect, test } from 'bun:test'
import {
  buildApprovePayload,
  buildFundPayload,
  buildReleasePayload,
  buildResolveDisputePayload,
  buildStartDisputePayload,
  cleanDistributions,
  contractIdFromSendResult,
  planAddMilestone,
  planRepaymentDeploy,
  repaymentDueAtIso,
  requireUnsigned,
} from '@/lib/deals/repayment-escrow-payloads'
import type { RepaymentEscrowRoles } from '@/lib/deals/repayment-escrow-types'

const roles: RepaymentEscrowRoles = {
  approver: 'GPLATFORM',
  serviceProvider: 'GPLATFORM',
  platformAddress: 'GPLATFORM',
  releaseSigner: 'GPLATFORM',
  disputeResolver: 'GRESOLVER',
}

const trustline = { address: 'CUSDC', symbol: 'USDC' }

describe('repayment escrow payloads', () => {
  test('planRepaymentDeploy builds the initialize payload and first milestone', () => {
    const planned = planRepaymentDeploy({
      params: {
        dealId: 'deal-1',
        adminAddress: 'GADMIN',
        principal: 10_000,
        aprPercent: 5,
        termDays: 30,
        productName: 'Coffee',
        firstMilestonePercent: 50,
        provider: 'stellar-wallets-kit',
      },
      investorAddress: 'GINVESTOR',
      roles,
      trustline,
    })

    expect(planned.engagementId).toBe('deal-1:repayment')
    expect(planned.totalGrossed).toBe(10_638.3)
    expect(planned.payload.signer).toBe('GADMIN')
    expect(planned.payload.roles).toEqual(roles)
    expect(planned.payload.trustline).toEqual(trustline)
    expect(planned.payload.milestones).toEqual([
      {
        description: 'Repayment milestone 1 (50%)',
        amount: 5_319.15,
        receiver: 'GINVESTOR',
      },
    ])
    expect(planned.initialMilestones).toEqual([
      {
        index: 0,
        description: 'Repayment milestone 1 (50%)',
        amount: 5_319.15,
        released: false,
      },
    ])
  })

  test('planRepaymentDeploy rejects a non-positive first milestone', () => {
    expect(() =>
      planRepaymentDeploy({
        params: {
          dealId: 'deal-1',
          adminAddress: 'GADMIN',
          principal: 0,
          aprPercent: 5,
          termDays: 30,
          productName: 'Coffee',
          provider: null,
        },
        investorAddress: 'GINVESTOR',
        roles,
        trustline,
      }),
    ).toThrow('First milestone amount must be positive')
  })

  test('buildFundPayload rounds and rejects non-positive amounts', () => {
    expect(
      buildFundPayload({
        dealId: 'd',
        contractId: 'C1',
        pymeAddress: 'GPYME',
        amount: 10.239,
        provider: null,
      }),
    ).toEqual({ contractId: 'C1', signer: 'GPYME', amount: 10.24 })
    expect(() =>
      buildFundPayload({
        dealId: 'd',
        contractId: 'C1',
        pymeAddress: 'GPYME',
        amount: 0,
        provider: null,
      }),
    ).toThrow('Fund amount must be positive')
  })

  test('approve, release, and dispute payloads stringify the index', () => {
    const release = {
      dealId: 'd',
      contractId: 'C1',
      releaseSigner: 'GSIGN',
      milestoneIndex: 2,
      provider: null,
    }
    expect(buildApprovePayload(release)).toEqual({
      contractId: 'C1',
      milestoneIndex: '2',
      approver: 'GSIGN',
    })
    expect(buildReleasePayload(release)).toEqual({
      contractId: 'C1',
      releaseSigner: 'GSIGN',
      milestoneIndex: '2',
    })
    expect(
      buildStartDisputePayload({
        dealId: 'd',
        contractId: 'C1',
        signer: 'GSIGN',
        milestoneIndex: 1,
        provider: null,
      }),
    ).toEqual({
      contractId: 'C1',
      signer: 'GSIGN',
      milestoneIndex: '1',
    })
  })

  test('cleanDistributions drops empty rows and requires a positive remainder', () => {
    expect(
      cleanDistributions([
        { address: '  GINV  ', amount: 10.239 },
        { address: '', amount: 5 },
        { address: 'GPYME', amount: 0 },
      ]),
    ).toEqual([{ address: 'GINV', amount: 10.24 }])
    expect(() =>
      cleanDistributions([{ address: 'GINV', amount: 0 }]),
    ).toThrow('At least one positive distribution is required')
  })

  test('buildResolveDisputePayload uses cleaned distributions', () => {
    expect(
      buildResolveDisputePayload({
        dealId: 'd',
        contractId: 'C1',
        disputeResolver: 'GRES',
        milestoneIndex: 0,
        distributions: [{ address: 'GINV', amount: 50 }],
        provider: null,
      }),
    ).toMatchObject({
      contractId: 'C1',
      disputeResolver: 'GRES',
      milestoneIndex: '0',
      distributions: [{ address: 'GINV', amount: 50 }],
    })
  })

  test('planAddMilestone defaults to remaining and rejects an overshoot', () => {
    const escrow = {
      engagementId: 'deal-1:repayment',
      title: 'T',
      description: 'D',
      platformFee: 1,
      trustline,
      isActive: true,
      milestones: [
        {
          description: 'M1',
          amount: 50,
          receiver: 'GINVESTOR',
          flags: { released: true },
        },
      ],
    }
    const planned = planAddMilestone({
      params: {
        dealId: 'deal-1',
        contractId: 'C1',
        adminAddress: 'GADMIN',
        provider: null,
      },
      escrow: escrow as never,
      totalGrossed: 100,
      investorAddress: 'GINVESTOR',
      roles,
    })
    expect(planned.amount).toBe(50)
    expect(planned.updatePayload.escrow.milestones).toHaveLength(2)

    expect(() =>
      planAddMilestone({
        params: {
          dealId: 'deal-1',
          contractId: 'C1',
          adminAddress: 'GADMIN',
          amount: 80,
          provider: null,
        },
        escrow: escrow as never,
        totalGrossed: 100,
        investorAddress: 'GINVESTOR',
        roles,
      }),
    ).toThrow('Milestone amount exceeds remaining (50 USDC)')
  })

  test('requireUnsigned and contractIdFromSendResult', () => {
    expect(
      requireUnsigned(
        { status: 'SUCCESS', unsignedTransaction: 'XDR' },
        'fail',
      ),
    ).toBe('XDR')
    expect(() => requireUnsigned({ status: 'ERROR' }, 'boom')).toThrow('boom')
    expect(
      contractIdFromSendResult({
        status: 'SUCCESS',
        escrow: { contractId: 'CNESTED' },
      }),
    ).toBe('CNESTED')
    expect(
      contractIdFromSendResult({ status: 'SUCCESS', contractId: 'CTOP' }),
    ).toBe('CTOP')
    expect(contractIdFromSendResult(undefined)).toBeUndefined()
  })

  test('repaymentDueAtIso uses term days from now', () => {
    expect(repaymentDueAtIso(30, new Date('2026-01-01T00:00:00.000Z'))).toBe(
      '2026-01-31T00:00:00.000Z',
    )
    expect(repaymentDueAtIso(0, new Date('2026-01-01T00:00:00.000Z'))).toBe(
      '2026-01-02T00:00:00.000Z',
    )
  })
})
