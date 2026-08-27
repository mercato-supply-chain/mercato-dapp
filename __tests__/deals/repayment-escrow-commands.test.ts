import { describe, expect, test } from 'bun:test'
import { createRepaymentEscrowCommands } from '@/lib/deals/repayment-escrow-commands'
import { DEFAULT_REPAYMENT_RETRY_POLICY } from '@/lib/deals/repayment-retry'
import type {
  DealRepository,
  EscrowBuilder,
  IndexerPort,
  RepaymentEscrowConfig,
  SendTxResult,
  TxTransport,
} from '@/lib/deals/repayment-escrow-types'

const config: RepaymentEscrowConfig = {
  platformAddress: 'GPLATFORM',
  trustline: { address: 'CUSDC', symbol: 'USDC' },
  roles: () => ({
    approver: 'GPLATFORM',
    serviceProvider: 'GPLATFORM',
    platformAddress: 'GPLATFORM',
    releaseSigner: 'GPLATFORM',
    disputeResolver: 'GRESOLVER',
  }),
}

function mockDeals(overrides: Partial<DealRepository> = {}): DealRepository & {
  patches: Record<string, unknown>[]
} {
  const patches: Record<string, unknown>[] = []
  return {
    patches,
    getRepaymentDueAt: async () => '2026-02-01T00:00:00.000Z',
    getRepaymentTotal: async () => 100,
    updateDeal: async (_id, patch) => {
      patches.push(patch)
    },
    resolveInvestorWallet: async () => 'GINVESTOR',
    ...overrides,
  }
}

function mockBuilder(overrides: Partial<EscrowBuilder> = {}): EscrowBuilder {
  const ok = async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })
  return {
    initialize: ok,
    fund: ok,
    approveMilestone: ok,
    releaseFunds: ok,
    updateEscrow: ok,
    startDispute: ok,
    resolveDispute: ok,
    ...overrides,
  }
}

describe('repayment escrow commands', () => {
  test('deploy uses the send result contract id and does not overwrite due date', async () => {
    const deals = mockDeals()
    const waits: number[] = []
    const signed: string[] = []
    const transport: TxTransport = {
      async signAndSend(unsigned, address, provider) {
        signed.push(`${provider}:${address}:${unsigned}`)
        return {
          status: 'SUCCESS',
          contractId: 'CDEPLOY',
        } satisfies SendTxResult
      },
    }
    const indexer: IndexerPort = {
      getByContractId: async () => null,
      getBySigner: async () => [],
      getBalance: async () => null,
    }
    const commands = createRepaymentEscrowCommands({
      builder: mockBuilder(),
      transport,
      indexer,
      deals,
      config,
      wait: async (ms) => {
        waits.push(ms)
      },
    })

    const result = await commands.deployRepaymentEscrow({
      dealId: 'deal-1',
      adminAddress: 'GADMIN',
      principal: 10_000,
      aprPercent: 5,
      termDays: 30,
      productName: 'Coffee',
      provider: 'stellar-wallets-kit',
    })

    expect(result.contractId).toBe('CDEPLOY')
    expect(signed).toEqual(['stellar-wallets-kit:GADMIN:XDR'])
    expect(waits).toEqual([])
    expect(deals.patches[0]).toMatchObject({
      escrow_contract_address: 'CDEPLOY',
      repayment_status: 'escrow_initialized',
    })
    expect(deals.patches[0]).not.toHaveProperty('repayment_due_at')
  })

  test('pollar deploy looks up the contract id with the configured delay', async () => {
    const deals = mockDeals()
    const waits: number[] = []
    let lookups = 0
    const indexer: IndexerPort = {
      getByContractId: async () => null,
      getBySigner: async () => {
        lookups += 1
        if (lookups < 2) return []
        return [
          { engagementId: 'deal-1:repayment', contractId: 'CPOLLAR' },
        ] as never
      },
      getBalance: async () => null,
    }
    const commands = createRepaymentEscrowCommands({
      builder: mockBuilder(),
      transport: {
        signAndSend: async () => undefined,
      },
      indexer,
      deals,
      config,
      wait: async (ms) => {
        waits.push(ms)
      },
    })

    const result = await commands.deployRepaymentEscrow({
      dealId: 'deal-1',
      adminAddress: 'GADMIN',
      principal: 10_000,
      aprPercent: 5,
      termDays: 30,
      productName: 'Coffee',
      provider: 'pollar',
    })

    expect(result.contractId).toBe('CPOLLAR')
    expect(lookups).toBe(2)
    expect(waits).toEqual([DEFAULT_REPAYMENT_RETRY_POLICY.pollarContractLookup.delayMs])
  })

  test('fund signs then waits the configured indexer lag before reconcile', async () => {
    const waits: number[] = []
    const deals = mockDeals()
    const indexer: IndexerPort = {
      getByContractId: async () =>
        ({
          milestones: [{ description: 'M1', amount: 100, flags: { released: false } }],
          balance: 100,
        }) as never,
      getBySigner: async () => [],
      getBalance: async () => 100,
    }
    let signed = 0
    const commands = createRepaymentEscrowCommands({
      builder: mockBuilder(),
      transport: {
        signAndSend: async () => {
          signed += 1
          return { status: 'SUCCESS' }
        },
      },
      indexer,
      deals,
      config,
      wait: async (ms) => {
        waits.push(ms)
      },
    })

    await commands.fundRepaymentEscrow({
      dealId: 'deal-1',
      contractId: 'C1',
      pymeAddress: 'GPYME',
      amount: 50,
      provider: null,
    })

    expect(signed).toBe(1)
    expect(waits).toEqual([DEFAULT_REPAYMENT_RETRY_POLICY.afterCommandMs.fund])
    expect(deals.patches[0]).toMatchObject({ repayment_status: 'ready_to_release' })
  })

  test('approve uses the shorter post-command delay; release uses the fund delay', async () => {
    const waits: number[] = []
    const indexer: IndexerPort = {
      getByContractId: async () =>
        ({
          milestones: [{ description: 'M1', amount: 100, flags: { released: false } }],
          balance: 0,
        }) as never,
      getBySigner: async () => [],
      getBalance: async () => 0,
    }
    const commands = createRepaymentEscrowCommands({
      builder: mockBuilder(),
      transport: { signAndSend: async () => ({ status: 'SUCCESS' }) },
      indexer,
      deals: mockDeals(),
      config,
      wait: async (ms) => {
        waits.push(ms)
      },
    })

    const params = {
      dealId: 'deal-1',
      contractId: 'C1',
      releaseSigner: 'GSIGN',
      milestoneIndex: 0,
      provider: null,
    }
    await commands.approveRepaymentMilestone(params)
    await commands.releaseRepaymentMilestone(params)

    expect(waits).toEqual([
      DEFAULT_REPAYMENT_RETRY_POLICY.afterCommandMs.approve,
      DEFAULT_REPAYMENT_RETRY_POLICY.afterCommandMs.release,
    ])
  })

  test('keeps signing on the provided wallet address', async () => {
    const signers: string[] = []
    const indexer: IndexerPort = {
      getByContractId: async () =>
        ({
          milestones: [{ description: 'M1', amount: 100, flags: { released: false } }],
          balance: 0,
        }) as never,
      getBySigner: async () => [],
      getBalance: async () => 0,
    }
    const commands = createRepaymentEscrowCommands({
      builder: mockBuilder(),
      transport: {
        signAndSend: async (_unsigned, address) => {
          signers.push(address)
          return { status: 'SUCCESS' }
        },
      },
      indexer,
      deals: mockDeals(),
      config,
      wait: async () => {},
    })

    await commands.startRepaymentDispute({
      dealId: 'deal-1',
      contractId: 'C1',
      signer: 'GDISPUTE',
      milestoneIndex: 0,
      provider: 'stellar-wallets-kit',
    })
    await commands.resolveRepaymentDispute({
      dealId: 'deal-1',
      contractId: 'C1',
      disputeResolver: 'GRESOLVER',
      milestoneIndex: 0,
      distributions: [{ address: 'GINVESTOR', amount: 100 }],
      provider: 'stellar-wallets-kit',
    })

    expect(signers).toEqual(['GDISPUTE', 'GRESOLVER'])
  })
})

describe('DEFAULT_REPAYMENT_RETRY_POLICY', () => {
  test('preserves the previous hardcoded delays', () => {
    expect(DEFAULT_REPAYMENT_RETRY_POLICY).toEqual({
      indexerEmptyMilestones: { extraAttempts: 2, delayMs: 2000 },
      pollarContractLookup: { attempts: 5, delayMs: 3000 },
      afterCommandMs: {
        fund: 1500,
        approve: 1000,
        release: 1500,
        addMilestone: 1500,
        dispute: 1500,
        resolveDispute: 1500,
        approveAndRelease: 1500,
      },
    })
  })
})
