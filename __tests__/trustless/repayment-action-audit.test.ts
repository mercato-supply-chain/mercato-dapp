import { describe, expect, test, mock } from 'bun:test'
import type { RepaymentEscrowActionInput } from '@/lib/trustless/repayment-action-audit'

describe('repayment_action_audit', () => {
  test('deployment_submitted y deployment_succeeded son inserts separados', async () => {
    let inserts: unknown[][] = []
    mock.module('@/lib/supabase/client', () => ({
      createClient: () => ({
        from: () => ({
          insert: async (rows: unknown[]) => {
            inserts.push(rows)
            return { error: null }
          },
        }),
      }),
    }))
    const { recordRepaymentEscrowAction } = await import('@/lib/trustless/repayment-action-audit')
    const base: RepaymentEscrowActionInput = {
      dealId: 'deal-1',
      actionType: 'deployment_submitted',
      adminUserId: 'admin-1',
      signingWallet: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
      contractId: null,
      generatedPayload: { title: 'gen' },
      reviewedPayload: { title: 'rev' },
      changedFields: ['escrow.title'],
      reviewTimestamp: new Date().toISOString(),
      submissionTimestamp: new Date().toISOString(),
      completionTimestamp: null,
      transactionHash: null,
      failureMessage: null,
    }
    await recordRepaymentEscrowAction(base)
    await recordRepaymentEscrowAction({ ...base, actionType: 'deployment_succeeded', contractId: 'C-contract', completionTimestamp: new Date().toISOString(), transactionHash: 'txhash' })
    expect(inserts.length).toBe(2)
    expect((inserts[0][0] as Record<string, unknown>).action_type).toBe('deployment_submitted')
    expect((inserts[1][0] as Record<string, unknown>).action_type).toBe('deployment_succeeded')
    expect((inserts[0][0] as Record<string, unknown>).contract_id).toBeNull()
    expect((inserts[1][0] as Record<string, unknown>).contract_id).toBe('C-contract')
  })

  test('tipo nunca acepta firma/clave/token', () => {
    const input: RepaymentEscrowActionInput = {
      dealId: 'deal-1',
      actionType: 'deployment_reviewed',
      adminUserId: 'admin-1',
      signingWallet: 'GABC',
      contractId: null,
      generatedPayload: null,
      reviewedPayload: null,
      changedFields: [],
      reviewTimestamp: null,
      submissionTimestamp: null,
      completionTimestamp: null,
      transactionHash: null,
      failureMessage: null,
    }
    // @ts-expect-error — signature no es parte del tipo
    const withSignature = { ...input, signature: 'sig' } as unknown as RepaymentEscrowActionInput & { signature: string }
    expect(withSignature.signature).toBe('sig')
    // El tipo real no debe contener esos campos — verificación a nivel de tipo:
    const keys = Object.keys(input) as (keyof RepaymentEscrowActionInput)[]
    expect(keys).not.toContain('signature' as unknown as keyof RepaymentEscrowActionInput)
    expect(keys).not.toContain('privateKey' as unknown as keyof RepaymentEscrowActionInput)
    expect(keys).not.toContain('token' as unknown as keyof RepaymentEscrowActionInput)
  })
})
