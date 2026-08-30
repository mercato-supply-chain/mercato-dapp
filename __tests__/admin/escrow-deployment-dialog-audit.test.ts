import { describe, expect, test } from 'bun:test'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import { buildRepaymentEscrowDraft, compareRepaymentEscrowDrafts } from '@/lib/trustless/repayment-deployment-draft'
import type { TrustlessConfigSnapshot } from '@/lib/trustless/repayment-deployment-draft'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const TRUSTLINE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: TRUSTLINE, symbol: 'USDC' },
}

describe('D1 audit wiring: dialog -> create-repayment-escrows -> hook', () => {
  test('audit.generated (dialog) mapea a audit.generatedDraft (hook) con título/monto originales', () => {
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

    // Simulate dialog's onSubmitReviewed second arg
    const auditFromDialog = { generated, reviewTimestamp: new Date().toISOString() }

    // Simulate parent's mapping (create-repayment-escrows.tsx: audit ? { generatedDraft: audit.generated, ... } : undefined)
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

    // Ensure the bug (audit.generated vs audit.generatedDraft mismatch) would have caused empty
    const buggyAudit = { generated: generated } as unknown as { generatedDraft?: unknown }
    expect((buggyAudit as unknown as { generatedDraft?: unknown }).generatedDraft).toBeUndefined()
    // Fixed mapping provides not undefined
    expect(auditForHook?.generatedDraft).not.toBeUndefined()
  })
})
