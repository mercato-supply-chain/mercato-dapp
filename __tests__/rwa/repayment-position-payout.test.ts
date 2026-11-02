import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Keypair, StrKey } from '@stellar/stellar-sdk'
import {
  allocateProRataAtomic,
  buildPayoutAuditContext,
  buildPositionPayoutSchedule,
  confirmPayout,
  DEFAULT_PAYOUT_FEE_POLICY,
  grossAtomicForNet,
  InMemoryRepaymentPayoutRepository,
  markPayoutFailed,
  markPayoutSubmitted,
  markPayoutUnknown,
  payoutIdempotencyKey,
  preparePositionPayoutIntents,
  type PayoutIntentContext,
  type PositionPayoutSchedule,
  type RepaymentPayoutEvidence,
  type RepaymentPayoutIntent,
  summarizePositionSettlement,
} from '@/lib/trustless/repayment-position-payout'
import {
  fromRepaymentPayoutIntentRow,
  toRepaymentPayoutIntentRow,
} from '@/lib/rwa/repayment-payout-intents'
import { planPositionPayoutDeploy } from '@/lib/trustless/repayment-position-payout-deploy'
import { createRepaymentEscrowCommands } from '@/lib/deals/repayment-escrow-commands'
import type {
  DealRepository,
  EscrowBuilder,
  IndexerPort,
  RepaymentEscrowConfig,
  RepaymentEscrowRoles,
} from '@/lib/deals/repayment-escrow-types'

const ACCOUNT_A = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT_B = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const PLATFORM = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey()
const ESCROW = StrKey.encodeContract(Buffer.alloc(32, 7))
const SAC = StrKey.encodeContract(Buffer.alloc(32, 8))
const ASSET_ID = '11'.repeat(32)
const DECIMALS = 7
const ATOMIC = 10 ** DECIMALS
const COMBINED_FEE_BPS =
  DEFAULT_PAYOUT_FEE_POLICY.platformFeeBps + DEFAULT_PAYOUT_FEE_POLICY.twFeeBps

function usdc(value: number): bigint {
  return BigInt(Math.round(value * ATOMIC))
}

function grossFor(net: bigint): bigint {
  return grossAtomicForNet(net, COMBINED_FEE_BPS)
}

function tranche(positionId: string, trancheIndex: number, net: bigint) {
  return {
    assetId: ASSET_ID,
    positionId,
    trancheIndex,
    netAtomic: net,
    grossAtomic: grossFor(net),
  }
}

function schedule(): PositionPayoutSchedule {
  const positionANet = usdc(6_600)
  const positionBNet = usdc(4_400)
  const aFirst = usdc(3_000)
  const aFinal = positionANet - aFirst
  const bFirst = usdc(2_000)
  const bFinal = positionBNet - bFirst
  const tranches = [
    tranche('position-a', 0, aFirst),
    tranche('position-a', 1, aFinal),
    tranche('position-b', 0, bFirst),
    tranche('position-b', 1, bFinal),
  ]
  const grossA = grossFor(aFirst) + grossFor(aFinal)
  const grossB = grossFor(bFirst) + grossFor(bFinal)
  return buildPositionPayoutSchedule({
    assetId: ASSET_ID,
    assetDecimals: DECIMALS,
    feePolicy: DEFAULT_PAYOUT_FEE_POLICY,
    positions: [
      {
        assetId: ASSET_ID,
        positionId: 'position-a',
        receiver: ACCOUNT_A,
        fundingWallet: ACCOUNT_A,
        netEntitlementAtomic: positionANet,
        grossObligationAtomic: grossA,
      },
      {
        assetId: ASSET_ID,
        positionId: 'position-b',
        receiver: ACCOUNT_B,
        fundingWallet: ACCOUNT_B,
        netEntitlementAtomic: positionBNet,
        grossObligationAtomic: grossB,
      },
    ],
    tranches,
    totalGrossAtomic: grossA + grossB,
    totalNetAtomic: positionANet + positionBNet,
  })
}

function context(overrides: Partial<PayoutIntentContext> = {}): PayoutIntentContext {
  return {
    network: 'testnet',
    escrowContract: ESCROW,
    sacContract: SAC,
    releaseSigner: PLATFORM,
    authorizedReleaseSigner: PLATFORM,
    ...overrides,
  }
}

function evidence(
  intent: RepaymentPayoutIntent,
  overrides: Partial<RepaymentPayoutEvidence> = {},
  index = 1,
): RepaymentPayoutEvidence {
  return {
    successful: true,
    network: intent.network,
    escrowContract: intent.escrowContract,
    sacContract: intent.sacContract,
    receiver: intent.receiver,
    netAtomic: intent.netAtomic,
    txHash: String(index).padStart(64, '0'),
    operationOrEventId: `event-${index}`,
    ledgerSeq: 100 + index,
    ...overrides,
  }
}

async function prepared() {
  const repository = new InMemoryRepaymentPayoutRepository()
  const intents = await preparePositionPayoutIntents(repository, schedule(), context())
  return { repository, intents }
}

function at(intents: readonly RepaymentPayoutIntent[], positionId: string, trancheIndex: number) {
  const intent = intents.find(
    (item) => item.positionId === positionId && item.trancheIndex === trancheIndex,
  )
  if (!intent) throw new Error(`missing intent ${positionId}/${trancheIndex}`)
  return intent
}

describe('position payout allocation and schedule', () => {
  test('allocates exact pro-rata entitlements and keeps dust deterministic', () => {
    const allocated = allocateProRataAtomic(usdc(11_000), [
      { positionId: 'position-a', unitsAtomic: 6_000 },
      { positionId: 'position-b', unitsAtomic: 4_000 },
    ])
    expect(allocated).toEqual([
      { positionId: 'position-a', amountAtomic: usdc(6_600).toString(10) },
      { positionId: 'position-b', amountAtomic: usdc(4_400).toString(10) },
    ])

    const dust = allocateProRataAtomic(101, [
      { positionId: 'a', unitsAtomic: 1 },
      { positionId: 'b', unitsAtomic: 1 },
      { positionId: 'c', unitsAtomic: 1 },
    ])
    expect(dust.reduce((sum, item) => sum + BigInt(item.amountAtomic), BigInt(0))).toBe(BigInt(101))
    expect(dust[dust.length - 1].amountAtomic).toBe('35')
  })

  test('binds each tranche to its position, immutable receiver and exact totals', () => {
    const built = schedule()
    expect(built.milestones).toHaveLength(4)
    expect(built.milestones.map((m) => `${m.positionId}:${m.trancheIndex}`)).toEqual([
      'position-a:0',
      'position-a:1',
      'position-b:0',
      'position-b:1',
    ])
    expect(built.milestones[0].receiver).toBe(ACCOUNT_A)
    expect(built.milestones[2].receiver).toBe(ACCOUNT_B)
    expect(built.milestones[0].netAtomic).toBe(usdc(3_000).toString(10))
    expect(built.milestones[2].netAtomic).toBe(usdc(2_000).toString(10))
    expect(built.totalNetAtomic).toBe(usdc(11_000).toString(10))
    expect(built.positions.map((p) => p.positionId)).toEqual(['position-a', 'position-b'])
    expect(built.positions.every((p) => p.matchesFrozenNet === true)).toBe(true)
  })

  test('is deterministic regardless of input ordering', () => {
    const first = schedule()
    const positionANet = usdc(6_600)
    const positionBNet = usdc(4_400)
    const tranches = [
      tranche('position-b', 1, positionBNet - usdc(2_000)),
      tranche('position-a', 1, positionANet - usdc(3_000)),
      tranche('position-b', 0, usdc(2_000)),
      tranche('position-a', 0, usdc(3_000)),
    ]
    const grossA = grossFor(usdc(3_000)) + grossFor(positionANet - usdc(3_000))
    const grossB = grossFor(usdc(2_000)) + grossFor(positionBNet - usdc(2_000))
    const second = buildPositionPayoutSchedule({
      assetId: ASSET_ID,
      assetDecimals: DECIMALS,
      feePolicy: DEFAULT_PAYOUT_FEE_POLICY,
      positions: [
        {
          assetId: ASSET_ID,
          positionId: 'position-b',
          receiver: ACCOUNT_B,
          fundingWallet: ACCOUNT_B,
          netEntitlementAtomic: positionBNet,
          grossObligationAtomic: grossB,
        },
        {
          assetId: ASSET_ID,
          positionId: 'position-a',
          receiver: ACCOUNT_A,
          fundingWallet: ACCOUNT_A,
          netEntitlementAtomic: positionANet,
          grossObligationAtomic: grossA,
        },
      ],
      tranches,
      totalGrossAtomic: grossA + grossB,
      totalNetAtomic: positionANet + positionBNet,
    })
    expect(second.commitment).toBe(first.commitment)
    expect(second.milestones.map((m) => m.milestoneIndex)).toEqual([0, 1, 2, 3])
  })

  test('rejects redirects, tampering, duplicates and incomplete positions', () => {
    const base = {
      assetId: ASSET_ID,
      assetDecimals: DECIMALS,
      feePolicy: DEFAULT_PAYOUT_FEE_POLICY,
      positions: [
        {
          assetId: ASSET_ID,
          positionId: 'p',
          receiver: ACCOUNT_A,
          fundingWallet: ACCOUNT_A,
          netEntitlementAtomic: 100,
        },
      ],
      tranches: [
        {
          assetId: ASSET_ID,
          positionId: 'p',
          trancheIndex: 0,
          netAtomic: 100,
          grossAtomic: 102,
        },
      ],
      totalGrossAtomic: 102,
      totalNetAtomic: 100,
    }

    expect(() =>
      buildPositionPayoutSchedule({ ...base, receiverOverride: ACCOUNT_B }),
    ).toThrow('do not support receiver overrides')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        positions: [{ ...base.positions[0], fundingWallet: ACCOUNT_B }],
      }),
    ).toThrow('immutable funding wallet')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [{ ...base.tranches[0], receiver: ACCOUNT_B }],
      }),
    ).toThrow('redirect the frozen receiver')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [{ ...base.tranches[0], netAtomic: 0 }],
      }),
    ).toThrow('must be positive')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [{ ...base.tranches[0], netAtomic: 103, grossAtomic: 102 }],
      }),
    ).toThrow('cannot exceed')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [base.tranches[0], base.tranches[0]],
      }),
    ).toThrow('duplicate tranche')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        positions: [
          base.positions[0],
          {
            assetId: ASSET_ID,
            positionId: 'unserved',
            receiver: ACCOUNT_B,
            fundingWallet: ACCOUNT_B,
          },
        ],
      }),
    ).toThrow('has no scheduled payout')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        positions: [{ ...base.positions[0], netEntitlementAtomic: 101 }],
      }),
    ).toThrow('does not match its frozen entitlement')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [{ ...base.tranches[0], grossAtomic: 100 }],
      }),
    ).toThrow('no release fee')
    expect(() =>
      buildPositionPayoutSchedule({ ...base, totalGrossAtomic: 103 }),
    ).toThrow('does not match the frozen gross total')
    expect(() =>
      buildPositionPayoutSchedule({
        ...base,
        tranches: [{ ...base.tranches[0], assetId: '22'.repeat(32) }],
      }),
    ).toThrow('different asset')
  })
})

describe('position payout deploy plan', () => {
  const roles: RepaymentEscrowRoles = {
    approver: PLATFORM,
    serviceProvider: PLATFORM,
    platformAddress: PLATFORM,
    releaseSigner: PLATFORM,
    disputeResolver: PLATFORM,
  }
  const trustline = { address: SAC, symbol: 'USDC' }

  test('maps every tranche to a distinct receiver milestone with audit bindings', () => {
    const built = schedule()
    const planned = planPositionPayoutDeploy({
      schedule: built,
      dealId: 'deal-1',
      productName: 'Coffee',
      signer: PLATFORM,
      roles,
      trustline,
    })

    expect(planned.payload.signer).toBe(PLATFORM)
    expect(planned.payload.platformFee).toBe(1)
    expect(planned.payload.milestones).toEqual(
      built.milestones.map((m) => ({
        description: m.description,
        amount: m.amount,
        receiver: m.receiver,
      })),
    )
    expect(planned.initialMilestones).toHaveLength(4)
    expect(planned.initialMilestones[0]).toMatchObject({
      index: 0,
      positionId: 'position-a',
      trancheIndex: 0,
      receiver: ACCOUNT_A,
      netAtomic: usdc(3_000).toString(10),
      scheduleCommitment: built.commitment,
    })
    expect(planned.initialMilestones[1]).toMatchObject({
      positionId: 'position-a',
      trancheIndex: 1,
    })
    expect(planned.initialMilestones[2]).toMatchObject({
      positionId: 'position-b',
      receiver: ACCOUNT_B,
    })
  })

  test('rejects unauthorized role or signer addresses', () => {
    const built = schedule()
    expect(() =>
      planPositionPayoutDeploy({
        schedule: built,
        dealId: 'deal-1',
        productName: 'Coffee',
        signer: ESCROW,
        roles,
        trustline,
      }),
    ).toThrow('signer must be a Stellar account')
    expect(() =>
      planPositionPayoutDeploy({
        schedule: built,
        dealId: 'deal-1',
        productName: 'Coffee',
        signer: PLATFORM,
        roles: { ...roles, releaseSigner: ESCROW },
        trustline,
      }),
    ).toThrow('roles.releaseSigner')
    expect(() =>
      planPositionPayoutDeploy({
        schedule: built,
        dealId: '',
        productName: 'Coffee',
        signer: PLATFORM,
        roles,
        trustline,
      }),
    ).toThrow('dealId is required')
  })

  test('the deploy command submits the frozen multi-receiver schedule in one transaction', async () => {
    const patches: Record<string, unknown>[] = []
    let initialized: { milestones: { receiver: string }[] } | null = null
    const ok = async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })
    const builder: EscrowBuilder = {
      initialize: async (payload) => {
        initialized = payload as unknown as { milestones: { receiver: string }[] }
        return { status: 'SUCCESS', unsignedTransaction: 'XDR' }
      },
      fund: ok,
      approveMilestone: ok,
      releaseFunds: ok,
      updateEscrow: ok,
      startDispute: ok,
      resolveDispute: ok,
    }
    const deals: DealRepository = {
      getRepaymentDueAt: async () => null,
      getRepaymentTotal: async () => 0,
      updateDeal: async (_id, patch) => {
        patches.push(patch)
      },
      resolveInvestorWallet: async () => null,
    }
    const indexer: IndexerPort = {
      getByContractId: async () => null,
      getBySigner: async () => [],
      getBalance: async () => null,
    }
    const config: RepaymentEscrowConfig = {
      platformAddress: PLATFORM,
      trustline,
      roles: () => roles,
    }
    const commands = createRepaymentEscrowCommands({
      builder,
      transport: {
        signAndSend: async () => ({ status: 'SUCCESS', contractId: ESCROW }),
      },
      indexer,
      deals,
      config,
      wait: async () => {},
    })

    const built = schedule()
    const result = await commands.deployRepaymentEscrow({
      dealId: 'deal-1',
      adminAddress: PLATFORM,
      productName: 'Coffee',
      provider: 'stellar-wallets-kit',
      termDays: 30,
      payoutSchedule: built,
    })

    expect(result.contractId).toBe(ESCROW)
    expect(initialized!.milestones).toHaveLength(4)
    expect(initialized!.milestones[0].receiver).toBe(ACCOUNT_A)
    expect(initialized!.milestones[2].receiver).toBe(ACCOUNT_B)
    expect(patches[0]).toMatchObject({
      escrow_contract_address: ESCROW,
      repayment_status: 'escrow_initialized',
      repayment_total_amount: Number(built.totalGrossAtomic) / ATOMIC,
    })
    expect(patches[0].repayment_milestones).toHaveLength(4)
    expect((patches[0].repayment_milestones as { positionId: string }[])[0].positionId).toBe(
      'position-a',
    )
    expect(patches[0]).toHaveProperty('repayment_due_at')
  })
})

describe('recoverable payout intents', () => {
  test('preparing is idempotent and rejects a different escrow context', async () => {
    const { repository, intents } = await prepared()
    expect(intents).toHaveLength(4)
    expect((await repository.listAll())).toHaveLength(4)

    const again = await preparePositionPayoutIntents(repository, schedule(), context())
    expect(again.map((i) => i.idempotencyKey)).toEqual(intents.map((i) => i.idempotencyKey))
    expect((await repository.listAll())).toHaveLength(4)

    await expect(
      preparePositionPayoutIntents(
        repository,
        schedule(),
        context({ escrowContract: StrKey.encodeContract(Buffer.alloc(32, 9)) }),
      ),
    ).rejects.toThrow('different schedule or escrow context')
  })

  test('submission is idempotent for the same hash and rejects a second hash', async () => {
    const { repository, intents } = await prepared()
    const intent = at(intents, 'position-a', 0)
    const hash = 'a'.repeat(64)
    const first = await markPayoutSubmitted(repository, intent.idempotencyKey, hash)
    expect(first.state).toBe('submitted')
    const second = await markPayoutSubmitted(repository, intent.idempotencyKey, hash)
    expect(second.submissionHash).toBe(hash)
    await expect(
      markPayoutSubmitted(repository, intent.idempotencyKey, 'b'.repeat(64)),
    ).rejects.toThrow('different transaction hash')
  })

  test('a payment to position A never changes position B settlement', async () => {
    const { repository, intents } = await prepared()
    const aFirst = at(intents, 'position-a', 0)
    const bFirst = at(intents, 'position-b', 0)

    await confirmPayout(repository, aFirst.idempotencyKey, evidence(aFirst, {}, 1))
    const afterA = await repository.listAll()
    const summaryA = summarizePositionSettlement(afterA, {
      positionId: 'position-a',
      requiredNetAtomic: usdc(6_600),
    })
    const summaryB = summarizePositionSettlement(afterA, {
      positionId: 'position-b',
      requiredNetAtomic: usdc(4_400),
    })
    expect(summaryA.status).toBe('partial')
    expect(summaryA.settledNetAtomic).toBe(usdc(3_000).toString(10))
    expect(summaryB.status).toBe('unpaid')
    expect(summaryB.settledNetAtomic).toBe('0')

    await confirmPayout(repository, bFirst.idempotencyKey, evidence(bFirst, {}, 2))
    const afterB = await repository.listAll()
    expect(
      summarizePositionSettlement(afterB, {
        positionId: 'position-a',
        requiredNetAtomic: usdc(6_600),
      }).settledNetAtomic,
    ).toBe(usdc(3_000).toString(10))
    expect(
      summarizePositionSettlement(afterB, {
        positionId: 'position-b',
        requiredNetAtomic: usdc(4_400),
      }).status,
    ).toBe('partial')
  })

  test('unknown and failed payouts settle nothing; unknown can recover from chain evidence', async () => {
    const { repository, intents } = await prepared()
    const aFirst = at(intents, 'position-a', 0)
    const aFinal = at(intents, 'position-a', 1)
    const bFirst = at(intents, 'position-b', 0)
    const bFinal = at(intents, 'position-b', 1)

    await markPayoutSubmitted(repository, aFirst.idempotencyKey, 'a'.repeat(64))
    await markPayoutUnknown(repository, aFirst.idempotencyKey, 'timeout')
    await markPayoutFailed(repository, aFinal.idempotencyKey, 'rejected')
    await markPayoutSubmitted(repository, bFirst.idempotencyKey, 'b'.repeat(64))
    // bFinal remains prepared (unfunded).

    const before = await repository.listAll()
    expect(
      summarizePositionSettlement(before, {
        positionId: 'position-a',
        requiredNetAtomic: usdc(6_600),
      }),
    ).toMatchObject({ status: 'unpaid', pendingTranches: 1, failedTranches: 1 })
    expect(
      summarizePositionSettlement(before, {
        positionId: 'position-b',
        requiredNetAtomic: usdc(4_400),
      }),
    ).toMatchObject({ status: 'unpaid', pendingTranches: 2 })

    await expect(
      confirmPayout(repository, aFinal.idempotencyKey, evidence(aFinal, {}, 3)),
    ).rejects.toThrow('definitively failed')
    await expect(
      markPayoutSubmitted(repository, bFinal.idempotencyKey, 'c'.repeat(64)),
    ).resolves.toMatchObject({ state: 'submitted' })

    const recovered = await confirmPayout(
      repository,
      aFirst.idempotencyKey,
      evidence(aFirst, {}, 4),
    )
    expect(recovered.state).toBe('confirmed')
    expect(
      summarizePositionSettlement(await repository.listAll(), {
        positionId: 'position-a',
        requiredNetAtomic: usdc(6_600),
      }),
    ).toMatchObject({ status: 'partial', settledNetAtomic: usdc(3_000).toString(10) })
  })

  test('confirmation requires exact receiver, network, escrow, SAC, amount and ledger', async () => {
    const { repository, intents } = await prepared()
    const intent = at(intents, 'position-a', 0)

    const tampering: Partial<RepaymentPayoutEvidence>[] = [
      { successful: false },
      { network: 'mainnet' },
      { escrowContract: StrKey.encodeContract(Buffer.alloc(32, 10)) },
      { sacContract: StrKey.encodeContract(Buffer.alloc(32, 11)) },
      { receiver: ACCOUNT_B },
      { netAtomic: usdc(3_000) - BigInt(1) },
      { netAtomic: usdc(3_000) + BigInt(1) },
      { txHash: 'not-a-hash' },
      { operationOrEventId: '' },
      { ledgerSeq: 0 },
    ]
    for (const override of tampering) {
      await expect(
        confirmPayout(repository, intent.idempotencyKey, evidence(intent, override, 5)),
      ).rejects.toThrow()
    }

    const confirmed = await confirmPayout(repository, intent.idempotencyKey, evidence(intent, {}, 6))
    expect(confirmed.state).toBe('confirmed')
  })

  test('a confirmed payout is recorded once and cannot be re-attributed', async () => {
    const { repository, intents } = await prepared()
    const intent = at(intents, 'position-a', 0)
    const proof = evidence(intent, {}, 7)
    await confirmPayout(repository, intent.idempotencyKey, proof)
    const replay = await confirmPayout(repository, intent.idempotencyKey, proof)
    expect(replay.confirmation).toEqual(
      expect.objectContaining({ txHash: proof.txHash, operationOrEventId: proof.operationOrEventId }),
    )
    expect((await repository.listAll()).filter((i) => i.state === 'confirmed')).toHaveLength(1)

    await expect(
      confirmPayout(repository, intent.idempotencyKey, evidence(intent, {}, 8)),
    ).rejects.toThrow('different evidence')
  })

  test('the same on-chain transfer cannot settle two positions', async () => {
    const { repository, intents } = await prepared()
    const first = at(intents, 'position-a', 0)
    const second = at(intents, 'position-b', 0)
    const proof = evidence(first, {}, 9)
    await confirmPayout(repository, first.idempotencyKey, proof)
    await expect(
      confirmPayout(repository, second.idempotencyKey, {
        ...evidence(second, {}, 9),
        txHash: proof.txHash,
        operationOrEventId: proof.operationOrEventId,
      }),
    ).rejects.toThrow('already attributed to another payout')
  })

  test('retry after a chain release and DB failure records the payout once', async () => {
    class FlakyRepository extends InMemoryRepaymentPayoutRepository {
      failNextSave = false

      override async save(intent: RepaymentPayoutIntent): Promise<void> {
        if (this.failNextSave) {
          this.failNextSave = false
          throw new Error('database unavailable')
        }
        await super.save(intent)
      }
    }

    const repository = new FlakyRepository()
    const intents = await preparePositionPayoutIntents(repository, schedule(), context())
    const intent = at(intents, 'position-a', 0)
    const proof = evidence(intent, {}, 10)

    repository.failNextSave = true
    await expect(confirmPayout(repository, intent.idempotencyKey, proof)).rejects.toThrow(
      'database unavailable',
    )
    const retried = await confirmPayout(repository, intent.idempotencyKey, proof)
    expect(retried.state).toBe('confirmed')
    expect((await repository.listAll()).filter((i) => i.state === 'confirmed')).toHaveLength(1)
  })

  test('settlement never closes on an underpayment and flags an overpayment', () => {
    const base = {
      idempotencyKey: 'k',
      assetId: ASSET_ID,
      positionId: 'position-a',
      trancheIndex: 0,
      milestoneIndex: 0,
      network: 'testnet' as const,
      escrowContract: ESCROW,
      sacContract: SAC,
      releaseSigner: PLATFORM,
      receiver: ACCOUNT_A,
      grossAtomic: '102',
      netAtomic: '100',
      feeAtomic: '2',
      scheduleCommitment: 'c',
      state: 'confirmed' as const,
      submissionHash: null,
      confirmation: null,
      lastError: null,
      updatedAt: '2026-10-22T00:00:00.000Z',
    }
    const under = summarizePositionSettlement([{ ...base, netAtomic: '99' }], {
      positionId: 'position-a',
      requiredNetAtomic: 100,
    })
    expect(under.status).toBe('partial')
    expect(under.outstandingNetAtomic).toBe('1')

    const exact = summarizePositionSettlement([base], {
      positionId: 'position-a',
      requiredNetAtomic: 100,
    })
    expect(exact.status).toBe('settled')
    expect(exact.outstandingNetAtomic).toBe('0')

    const over = summarizePositionSettlement([{ ...base, netAtomic: '101' }], {
      positionId: 'position-a',
      requiredNetAtomic: 100,
    })
    expect(over.status).toBe('overpaid')
  })

  test('idempotency keys are stable and position-scoped', () => {
    expect(payoutIdempotencyKey(ASSET_ID.toUpperCase(), 'position-a', 1)).toBe(
      payoutIdempotencyKey(ASSET_ID, 'position-a', 1),
    )
    expect(payoutIdempotencyKey(ASSET_ID, 'position-a', 1)).not.toBe(
      payoutIdempotencyKey(ASSET_ID, 'position-b', 1),
    )
  })
})

describe('payout persistence and audit binding', () => {
  test('round-trips a persisted intent row and its confirmation evidence', async () => {
    const { intents } = await prepared()
    const intent = at(intents, 'position-a', 0)
    const row = toRepaymentPayoutIntentRow(intent, 'deal-1')
    expect(row).toMatchObject({
      idempotency_key: intent.idempotencyKey,
      deal_id: 'deal-1',
      asset_id: ASSET_ID,
      position_id: 'position-a',
      tranche_index: 0,
      gross_atomic: intent.grossAtomic,
      net_atomic: intent.netAtomic,
      fee_atomic: intent.feeAtomic,
      schedule_commitment: intent.scheduleCommitment,
      state: 'prepared',
      confirmation_tx_hash: null,
    })

    const parsed = fromRepaymentPayoutIntentRow({
      ...row,
      deal_id: 'deal-1',
      created_at: '2026-10-22T00:00:00.000Z',
      updated_at: intent.updatedAt,
    })
    expect(parsed).toEqual(intent)

    const confirmed: RepaymentPayoutIntent = {
      ...intent,
      state: 'confirmed',
      submissionHash: 'a'.repeat(64),
      confirmation: {
        txHash: 'a'.repeat(64),
        operationOrEventId: 'event-1',
        ledgerSeq: 123,
        confirmedAt: '2026-10-22T01:00:00.000Z',
      },
    }
    const confirmedRow = toRepaymentPayoutIntentRow(confirmed)
    const parsedConfirmed = fromRepaymentPayoutIntentRow({
      ...confirmedRow,
      created_at: '2026-10-22T00:00:00.000Z',
      updated_at: confirmed.updatedAt,
    })
    expect(parsedConfirmed).toEqual(confirmed)
    expect(confirmedRow.deal_id).toBeUndefined()
  })

  test('builds an audit context bound to position, tranche and outstanding amount', () => {
    const built = schedule()
    const milestone = built.milestones[0]
    const context = buildPayoutAuditContext(built, milestone, {
      settledNetAtomic: '0',
      outstandingNetAtomic: milestone.netAtomic,
    })
    expect(context).toMatchObject({
      assetId: ASSET_ID,
      positionId: 'position-a',
      trancheIndex: 0,
      milestoneIndex: 0,
      receiver: ACCOUNT_A,
      grossAtomic: milestone.grossAtomic,
      netAtomic: milestone.netAtomic,
      scheduleCommitment: built.commitment,
      settledNetAtomic: '0',
      outstandingNetAtomic: milestone.netAtomic,
    })
  })

  test('ships an additive intent migration with unique confirmation evidence', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '20261022000100_rwa_repayment_payout_intents.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('create table if not exists public.rwa_repayment_payout_intents')
    expect(migration).toContain('uq_rwa_repayment_payout_intents_confirmation')
    expect(migration).toContain("where state = 'confirmed'")
    expect(migration).toContain('public.rwa_is_admin()')
  })
})
