import { describe, expect, test } from 'bun:test'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import { buildRepaymentEscrowDraft, compareRepaymentEscrowDrafts } from '@/lib/trustless/repayment-deployment-draft'
import type { TrustlessConfigSnapshot } from '@/lib/trustless/repayment-deployment-draft'
import { buildDeploymentAuditPayload } from '@/components/admin/repayment-escrow/escrow-deployment-review-dialog'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const TRUSTLINE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: TRUSTLINE, symbol: 'USDC' },
}

describe('buildDeploymentAuditPayload', () => {
  test('returns object with generated and reviewTimestamp keys', () => {
    const generated = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-1',
        productName: 'Test product',
        principal: 10000,
        aprPercent: 10,
        termDays: 90,
        investorAddress: ACCOUNT2,
        signerChannel: ACCOUNT,
      },
      CONFIG,
    )
    const timestamp = '2026-08-29T12:00:00.000Z'

    const result = buildDeploymentAuditPayload(generated, timestamp)

    expect(result).toHaveProperty('generated')
    expect(result).toHaveProperty('reviewTimestamp')
    expect(result.generated).toBe(generated)
    expect(result.reviewTimestamp).toBe(timestamp)
  })

  test('handles null generated gracefully', () => {
    const timestamp = '2026-08-29T12:00:00.000Z'

    const result = buildDeploymentAuditPayload(null, timestamp)

    expect(result.generated).toBeNull()
    expect(result.reviewTimestamp).toBe(timestamp)
  })

  test('mapped result works with compareRepaymentEscrowDrafts to detect changes', () => {
    const generated = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-1',
        productName: 'Test product',
        principal: 10000,
        aprPercent: 10,
        termDays: 90,
        investorAddress: ACCOUNT2,
        signerChannel: ACCOUNT,
      },
      CONFIG,
    )
    const reviewed: RepaymentEscrowDeploymentDraft = {
      ...generated,
      title: 'Edited title',
      description: 'Edited description',
      milestones: [
        { ...generated.milestones[0], amount: generated.milestones[0].amount + 100, receiver: ACCOUNT },
        ...generated.milestones.slice(1),
      ],
    }

    const timestamp = new Date().toISOString()
    const auditFromDialog = buildDeploymentAuditPayload(generated, timestamp)

    // Simulate parent's mapping (create-repayment-escrows.tsx)
    const auditForHook = auditFromDialog
      ? { generatedDraft: auditFromDialog.generated, reviewTimestamp: auditFromDialog.reviewTimestamp }
      : undefined

    expect(auditForHook?.generatedDraft).toBeDefined()
    expect(auditForHook?.generatedDraft?.title).toBe('Repayment · Test product')
    expect(auditForHook?.generatedDraft?.description).toBe('SMB multi-release repayment for deal deal-1')
    expect(auditForHook?.generatedDraft?.milestones[0].amount).toBe(generated.milestones[0].amount)
    expect(auditForHook?.generatedDraft?.title).not.toBe(reviewed.title)
    expect(auditForHook?.generatedDraft?.milestones[0].amount).not.toBe(reviewed.milestones[0].amount)

    // Simulate hook's changedFields derivation
    const changedFields = auditForHook?.generatedDraft
      ? compareRepaymentEscrowDrafts(auditForHook.generatedDraft, reviewed).map((c) => c.path)
      : []

    expect(changedFields).toContain('escrow.title')
    expect(changedFields).toContain('milestone[0].amount')
    expect(changedFields).toContain('milestone[0].receiver')
  })
})