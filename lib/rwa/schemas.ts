/**
 * Request and response schemas for the RWA funding API.
 *
 * The client never supplies a network, contract id, token, nonce or
 * contribution reference: those are resolved server-side from the asset row
 * and the reserved intent. The schemas therefore only accept the minimum a
 * browser legitimately needs to say.
 */

import { z } from 'zod'

const hex32 = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{64}$/, 'Expected a 32-byte hex value')

const stellarAddress = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^G[0-9A-Z]{55}$/, 'Expected a Stellar address')

/** A positive decimal amount. Precision is checked against the token decimals. */
const positiveAmount = z.union([
  z.number().positive().finite(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Expected a positive decimal amount')
    .refine((value) => Number(value) > 0, 'Expected a positive decimal amount'),
])

export const prepareContributionSchema = z.object({
  /** Registry asset id (32-byte hex). */
  assetId: hex32,
  /** Amount in whole token units. */
  amount: positiveAmount,
  /** Wallet the investor will sign with. Must be a verified wallet of theirs. */
  walletAddress: stellarAddress,
  /** Client supplied idempotency key; replaying it returns the same attempt. */
  idempotencyKey: z.string().trim().min(8).max(200),
})

export const submitContributionSchema = z.object({
  attemptId: z.string().uuid(),
  /** Hash of the submitted transaction. */
  txHash: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, 'Expected a transaction hash'),
})

export const confirmContributionSchema = z.object({
  attemptId: z.string().uuid(),
  txHash: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, 'Expected a transaction hash'),
})

export const contributionStatusSchema = z.object({
  attemptId: z.string().uuid().optional(),
  assetId: hex32.optional(),
})

export const supplierSettlementSchema = z.object({
  assetId: hex32,
})

export const refundSchema = z.object({
  assetId: hex32,
  positionId: z.number().int().min(0),
})

export type PrepareContributionInput = z.infer<typeof prepareContributionSchema>
export type SubmitContributionInput = z.infer<typeof submitContributionSchema>
export type ConfirmContributionInput = z.infer<typeof confirmContributionSchema>
export type ContributionStatusInput = z.infer<typeof contributionStatusSchema>
export type SupplierSettlementInput = z.infer<typeof supplierSettlementSchema>
export type RefundInput = z.infer<typeof refundSchema>

const documentInput = z.object({
  kind: z.string().trim().min(1).max(64),
  contentHash: z.string().trim().regex(/^[0-9a-fA-F]{64}$/),
  opaqueRef: z.string().trim().min(1).max(500).optional(),
  byteLength: z.number().int().positive().optional(),
})

export const prepareIssuanceSchema = z.object({
  dealId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
  signingWallet: stellarAddress,
  documents: z.array(documentInput).min(1).max(8),
})

export const submitIssuanceSchema = z.object({
  attemptId: z.string().uuid(),
  signedXdr: z.string().trim().min(20),
})

export const issuanceStatusSchema = z.object({
  attemptId: z.string().uuid(),
})

export const redeemPositionSchema = z.object({
  positionId: z.string().uuid(),
  amountAtomic: z.string().trim().regex(/^[1-9][0-9]*$/),
  txHash: z.string().trim().regex(/^[0-9a-fA-F]{64}$/),
  operationId: z.string().trim().min(1).max(128).default('release'),
})

export type PrepareIssuanceInput = z.infer<typeof prepareIssuanceSchema>
export type SubmitIssuanceInput = z.infer<typeof submitIssuanceSchema>

/** Coerce a zod failure into a flat field -> message map. */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!details[key]) details[key] = issue.message
  }
  return details
}
