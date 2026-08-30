import { describe, expect, test } from 'bun:test'
import {
  buildRepaymentEscrowDraft,
  calculateRepaymentMilestone,
  calculateRepaymentPercentageFromAmount,
  compareRepaymentEscrowDrafts,
  applyOneTimeReceiverOverride,
  toTrustlessWorkDeploymentPayload,
  defaultRepaymentRoles,
  type TrustlessConfigSnapshot,
} from '@/lib/trustless/repayment-deployment-draft'
import {
  validateRepaymentEscrowDraft,
  validateRepaymentRoleOverrides,
} from '@/lib/trustless/repayment-deployment-validation'
import {
  buildAuthoritativeSnapshot,
  compareAuthoritativeSnapshot,
} from '@/lib/trustless/repayment-deployment-guard'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const TRUSTLINE =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: TRUSTLINE, symbol: 'USDC' },
}

function draft(overrides: Partial<Parameters<typeof buildRepaymentEscrowDraft>[0]> = {}) {
  return buildRepaymentEscrowDraft(
    {
      dealId: 'deal-42',
      productName: 'Medical supply order',
      principal: 10_000,
      aprPercent: 10,
      termDays: 90,
      investorAddress: ACCOUNT2,
      signerChannel: ACCOUNT,
      ...overrides,
    },
    CONFIG,
  )
}

describe('buildRepaymentEscrowDraft', () => {
  test('generates the expected draft from deal + config', () => {
    const d = draft()
    expect(d.dealId).toBe('deal-42')
    expect(d.engagementId).toBe('deal-42:repayment')
    expect(d.escrowType).toBe('multi-release')
    expect(d.network).toBe('testnet')
    expect(d.sourceInvestor).toBe(ACCOUNT2)
    expect(d.signer).toBe(ACCOUNT)
    expect(d.roles.approver).toBe(ACCOUNT)
    expect(d.roles.platformAddress).toBe(ACCOUNT)
    expect(d.milestones.length).toBe(1)
    expect(d.milestones[0].receiver).toBe(ACCOUNT2)
    // 10% of $10k principal = $1k profit → net target $11k; grossed includes 1.3% fees.
    expect(d.repayment.principal).toBe(10_000)
    expect(d.repayment.investorProfit).toBe(1_000)
    expect(d.repayment.investorNetTarget).toBe(11_000)
    expect(d.repayment.totalGrossed).toBeGreaterThan(11_000)
    // Default first milestone = 50% of grossed.
    expect(d.milestones[0].amount).toBeCloseTo(d.repayment.totalGrossed * 0.5, 2)
  })

  test('throws when the investor address is invalid', () => {
    expect(() => draft({ investorAddress: 'not-stellar' })).toThrow()
  })

  test('throws when platform config is missing', () => {
    expect(() =>
      buildRepaymentEscrowDraft(
        {
          dealId: 'x',
          productName: 'p',
          principal: 100,
          aprPercent: 10,
          termDays: 30,
          investorAddress: ACCOUNT2,
          signerChannel: ACCOUNT,
        },
        { ...CONFIG, platformAddress: '' },
      ),
    ).toThrow('Platform address')
  })
})

describe('milestone amount / percentage sync', () => {
  test('calculateRepaymentMilestone derives amount from percent', () => {
    const d = draft()
    expect(calculateRepaymentMilestone(d.repayment.totalGrossed, 25)).toBeCloseTo(
      d.repayment.totalGrossed * 0.25,
      2,
    )
  })

  test('calculateRepaymentPercentageFromAmount derives percent from amount', () => {
    const d = draft()
    const half = calculateRepaymentMilestone(d.repayment.totalGrossed, 50)
    expect(calculateRepaymentPercentageFromAmount(d.repayment.totalGrossed, half)).toBe(50)
  })

  test('invalid inputs return 0', () => {
    expect(calculateRepaymentMilestone(0, 50)).toBe(0)
    expect(calculateRepaymentPercentageFromAmount(0, 100)).toBe(0)
    expect(calculateRepaymentPercentageFromAmount(100, 0)).toBe(0)
  })
})
describe('toTrustlessWorkDeploymentPayload', () => {
  test('maps the reviewed draft to the wire shape', () => {
    const payload = toTrustlessWorkDeploymentPayload(draft())
    expect(payload.signer).toBe(ACCOUNT)
    expect(payload.engagementId).toBe('deal-42:repayment')
    expect(payload.milestones[0].receiver).toBe(ACCOUNT2)
    expect(payload.trustline.symbol).toBe('USDC')
    expect(payload.roles.platformAddress).toBe(ACCOUNT)
  })
})

describe('applyOneTimeReceiverOverride', () => {
  test('replaces only the milestone receiver without touching the profile', () => {
    const d = draft()
    const overridden = applyOneTimeReceiverOverride(d, ACCOUNT2)
    expect(overridden.milestones[0].receiver).toBe(ACCOUNT2)
    expect(overridden.sourceInvestor).toBe(ACCOUNT2)
    expect(d.milestones[0].receiver).toBe(ACCOUNT2)
  })

  test('overrides to a different valid address and keeps sourceInvestor as generated', () => {
    const d = draft()
    const overridden = applyOneTimeReceiverOverride(d, ACCOUNT)
    expect(overridden.milestones[0].receiver).toBe(ACCOUNT)
    expect(overridden.sourceInvestor).toBe(ACCOUNT2)
    expect(d.milestones[0].receiver).toBe(ACCOUNT2)
    expect(overridden.milestones[0].receiver).not.toBe(d.milestones[0].receiver)
  })

  test('throws on an invalid override address', () => {
    expect(() => applyOneTimeReceiverOverride(draft(), 'not-stellar')).toThrow()
  })
})

describe('compareRepaymentEscrowDrafts', () => {
  test('reports editable changes', () => {
    const d = draft()
    const changed = { ...d, title: 'Edited title' }
    const diffs = compareRepaymentEscrowDrafts(d, changed)
    expect(diffs.map((c) => c.path)).toContain('escrow.title')
  })

  test('no changes when drafts are equal', () => {
    expect(compareRepaymentEscrowDrafts(draft(), draft())).toEqual([])
  })
})
describe('validateRepaymentEscrowDraft', () => {
  test('a generated draft is valid', () => {
    const result = validateRepaymentEscrowDraft(draft())
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  test('invalid receiver address blocks validation', () => {
    const d = {
      ...draft(),
      milestones: [{ ...draft().milestones[0], receiver: 'bad' }],
    }
    const result = validateRepaymentEscrowDraft(d)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'invalid_receiver_address')).toBe(true)
  })

  test('zero milestone amount blocks validation', () => {
    const d = {
      ...draft(),
      milestones: [{ ...draft().milestones[0], amount: 0 }],
    }
    const result = validateRepaymentEscrowDraft(d)
    expect(result.ok).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'milestone_amount_non_positive'),
    ).toBe(true)
  })

  test('amount exceeding total grossed blocks validation', () => {
    const total = draft().repayment.totalGrossed
    const d = {
      ...draft(),
      milestones: [{ ...draft().milestones[0], amount: total + 1 }],
    }
    const result = validateRepaymentEscrowDraft(d)
    expect(result.ok).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'milestone_amount_exceeds_total'),
    ).toBe(true)
  })

  test('non-default first milestone produces a warning', () => {
    const d = {
      ...draft(),
      milestones: [
        { ...draft().milestones[0], amount: draft().repayment.totalGrossed * 0.6 },
      ],
    }
    const result = validateRepaymentEscrowDraft(d)
    expect(
      result.warnings.some((w) => w.kind === 'non_default_first_milestone'),
    ).toBe(true)
  })

  test('missing configuration blocks validation', () => {
    const d = {
      ...draft(),
      roles: defaultRepaymentRoles({ ...CONFIG, platformAddress: '' }),
    }
    const result = validateRepaymentEscrowDraft(d)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'configuration_error')).toBe(true)
  })
})
describe('validateRepaymentRoleOverrides', () => {
  test('a role override warns and requires additional confirmation', () => {
    const result = validateRepaymentRoleOverrides({ approver: ACCOUNT2 }, draft())
    expect(result.requiresAdditionalConfirmation).toBe(true)
    expect(result.warnings.some((w) => w.kind === 'role_override')).toBe(true)
  })

  test('a contract id in a role is a blocking network mismatch', () => {
    const result = validateRepaymentRoleOverrides(
      { disputeResolver: TRUSTLINE },
      draft(),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'network_mismatch')).toBe(true)
  })

  test('an invalid role address is a blocking error', () => {
    const result = validateRepaymentRoleOverrides({ releaseSigner: 'nope' }, draft())
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'invalid_role_address')).toBe(true)
  })

  test('no overrides require no additional confirmation', () => {
    const result = validateRepaymentRoleOverrides({}, draft())
    expect(result.requiresAdditionalConfirmation).toBe(false)
  })
})

describe('stale-data guard (pure comparison)', () => {
  const row = {
    id: 'deal-42',
    amount: 10_000,
    interest_rate: 10,
    term_days: 90,
    escrow_contract_address: null,
    repayment_status: 'order_confirmed',
    repayment_total_amount: draft().repayment.totalGrossed,
    investor: { address: ACCOUNT2 },
  }

  test('unchanged authoritative state reports no diffs', () => {
    const snapshot = buildAuthoritativeSnapshot(row)
    expect(compareAuthoritativeSnapshot(snapshot, draft(), CONFIG)).toEqual([])
  })

  test('an assigned escrow contract is flagged as stale', () => {
    const snapshot = buildAuthoritativeSnapshot({
      ...row,
      escrow_contract_address: 'CONTRACT-1',
    })
    const result = compareAuthoritativeSnapshot(snapshot, draft(), CONFIG)
    expect(result.map((d) => d.field)).toContain('deal.escrow_contract_address')
  })

  test('a changed repayment_status is flagged', () => {
    const snapshot = buildAuthoritativeSnapshot({ ...row, repayment_status: 'funded' })
    const result = compareAuthoritativeSnapshot(snapshot, draft(), CONFIG)
    expect(result.map((d) => d.field)).toContain('deal.repayment_status')
  })

  test('a changed investor is flagged', () => {
    const snapshot = buildAuthoritativeSnapshot({ ...row, investor: { address: ACCOUNT } })
    const result = compareAuthoritativeSnapshot(snapshot, draft(), CONFIG)
    expect(result.map((d) => d.field)).toContain('deal.investor_address')
  })

  test('changed platform configuration is flagged', () => {
    const result = compareAuthoritativeSnapshot(
      buildAuthoritativeSnapshot(row),
      draft(),
      { ...CONFIG, platformAddress: ACCOUNT2 },
    )
    expect(result.map((d) => d.field)).toContain('config.platform_address')
  })
})