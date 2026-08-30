'use client'

import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import type { CreateEscrowItem } from '@/lib/admin/types'
import {
  applyOneTimeReceiverOverride,
  buildRepaymentEscrowDraft,
  calculateRepaymentMilestone,
  calculateRepaymentPercentageFromAmount,
  compareRepaymentEscrowDrafts,
  type RepaymentEscrowDeploymentDraft,
  type RepaymentRoles,
} from '@/lib/trustless/repayment-deployment-draft'
import {
  validateRepaymentEscrowDraft,
  validateRepaymentRoleOverrides,
  type RepaymentRoleOverrides,
} from '@/lib/trustless/repayment-deployment-validation'
import { buildRepaymentConfigSnapshot } from '@/lib/trustless/repayment-config-snapshot'
import {
  revalidateAuthoritativeState,
  type RevalidationResult,
  type StaleFieldDiff,
} from '@/lib/trustless/repayment-deployment-guard'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'

const stellarAccountSchema = z.string().regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar account address')

const deploymentInputSchema = z.object({
  dealId: z.string().min(1, 'Deal required'),
  investorAddress: stellarAccountSchema,
  signerChannel: stellarAccountSchema,
  principal: z.number().positive(),
  aprPercent: z.number().nonnegative(),
  termDays: z.number().int().positive(),
})

export type DeploymentDraftStage = 'idle' | 'review' | 'edit' | 'confirm'

export type UseRepaymentDeploymentDraftParams = {
  readonly item: CreateEscrowItem
  readonly signerAddress: string
  readonly initialMode?: DeploymentDraftStage
}

export type UseRepaymentDeploymentDraftReturn = {
  readonly generated: RepaymentEscrowDeploymentDraft | null
  readonly draft: RepaymentEscrowDeploymentDraft | null
  readonly buildError: string | null
  readonly stage: DeploymentDraftStage
  readonly setStage: (stage: DeploymentDraftStage) => void
  readonly validation: ReturnType<typeof validateRepaymentEscrowDraft> | null
  readonly roleValidation: ReturnType<typeof validateRepaymentRoleOverrides> | null
  readonly changes: ReturnType<typeof compareRepaymentEscrowDrafts>
  readonly percentFromAmount: number
  readonly staleFields: readonly StaleFieldDiff[] | null
  readonly rolesConfirmed: boolean
  readonly setRolesConfirmed: (v: boolean) => void
  readonly checking: boolean
  readonly build: () => void
  readonly resetToGenerated: () => void
  readonly cancelEdits: () => void
  readonly patchTitle: (title: string) => void
  readonly patchDescription: (description: string) => void
  readonly patchMilestoneDescription: (description: string) => void
  readonly patchMilestonePercent: (percent: number) => void
  readonly patchMilestoneAmount: (amount: number) => void
  readonly applyReceiverOverride: (receiver: string | null) => void
  readonly patchRole: (role: EditableRoleKey, value: string) => void
  readonly revalidateForConfirm: () => Promise<RevalidationResult | null>
  readonly applyExternalRevalidation: (result: RevalidationResult) => void
}

const EDITABLE_ROLE_KEYS = ['approver', 'serviceProvider', 'disputeResolver'] as const
export type EditableRoleKey = (typeof EDITABLE_ROLE_KEYS)[number]

function collectRoleOverrides(
  generated: RepaymentEscrowDeploymentDraft,
  draft: RepaymentEscrowDeploymentDraft,
): RepaymentRoleOverrides {
  const overrides: Partial<Record<EditableRoleKey, string>> = {}
  for (const key of EDITABLE_ROLE_KEYS) {
    if (draft.roles[key] !== generated.roles[key]) overrides[key] = draft.roles[key]
  }
  return overrides as RepaymentRoleOverrides
}

export function useRepaymentDeploymentDraft({
  item,
  signerAddress,
  initialMode = 'review',
}: UseRepaymentDeploymentDraftParams): UseRepaymentDeploymentDraftReturn {
  const [stage, setStage] = useState<DeploymentDraftStage>(() =>
    initialMode === 'edit' ? 'edit' : 'review',
  )
  const [generated, setGenerated] = useState<RepaymentEscrowDeploymentDraft | null>(null)
  const [draft, setDraft] = useState<RepaymentEscrowDeploymentDraft | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [rolesConfirmed, setRolesConfirmed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [staleFields, setStaleFields] = useState<readonly StaleFieldDiff[] | null>(null)

  const build = useCallback(() => {
    if (!item.investorAddress) {
      setGenerated(null)
      setDraft(null)
      setBuildError(
        'El inversionista todavía no tiene wallet asignada; no se puede preparar el despliegue.',
      )
      return
    }

    const parsed = deploymentInputSchema.safeParse({
      dealId: item.dealId,
      investorAddress: item.investorAddress.trim(),
      signerChannel: signerAddress.trim(),
      principal: item.principal,
      aprPercent: item.aprPercent,
      termDays: item.termDays,
    })
    if (!parsed.success) {
      setGenerated(null)
      setDraft(null)
      setBuildError(parsed.error.errors.map((e) => e.message).join(' | '))
      return
    }

    if (!isLikelyStellarAddress(signerAddress.trim())) {
      setGenerated(null)
      setDraft(null)
      setBuildError('Connected signer address must be a valid Stellar address')
      return
    }

    try {
      const base = buildRepaymentEscrowDraft(
        {
          dealId: item.dealId,
          productName: item.dealProductName || item.dealTitle,
          principal: item.principal,
          aprPercent: item.aprPercent,
          termDays: item.termDays,
          investorAddress: item.investorAddress,
          signerChannel: signerAddress,
        },
        buildRepaymentConfigSnapshot(),
      )
      setBuildError(null)
      setRolesConfirmed(false)
      setChecking(false)
      setStaleFields(null)
      setGenerated(base)
      setDraft(base)
      setStage(initialMode === 'edit' ? 'edit' : 'review')
    } catch (error) {
      setGenerated(null)
      setDraft(null)
      setBuildError(error instanceof Error ? error.message : 'No se pudo construir el borrador')
    }
  }, [initialMode, item.aprPercent, item.dealId, item.dealProductName, item.dealTitle, item.investorAddress, item.principal, item.termDays, signerAddress])

  const validation = useMemo(() => {
    if (!generated || !draft) return null
    return validateRepaymentEscrowDraft(draft, generated)
  }, [draft, generated])

  const roleValidation = useMemo(() => {
    if (!generated || !draft) return null
    return validateRepaymentRoleOverrides(collectRoleOverrides(generated, draft), generated)
  }, [draft, generated])

  const changes = useMemo(() => {
    if (!generated || !draft) return []
    return compareRepaymentEscrowDrafts(generated, draft)
  }, [draft, generated])

  const percentFromAmount = useMemo(() => {
    if (!draft || !draft.milestones[0]) return 0
    return calculateRepaymentPercentageFromAmount(
      draft.repayment.totalGrossed,
      draft.milestones[0].amount,
    )
  }, [draft])

  const patchFirstMilestone = useCallback(
    (patch: Partial<{ description: string; amount: number }>) => {
      setDraft((current) => {
        if (!current || !current.milestones[0]) return current
        const milestone = { ...current.milestones[0], ...patch }
        return { ...current, milestones: [milestone, ...current.milestones.slice(1)] }
      })
    },
    [],
  )

  const patchMilestoneDescription = useCallback(
    (description: string) => patchFirstMilestone({ description }),
    [patchFirstMilestone],
  )

  const patchMilestonePercent = useCallback(
    (percent: number) => {
      if (!draft || !draft.milestones[0]) return
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return
      const amount = calculateRepaymentMilestone(draft.repayment.totalGrossed, percent)
      const stillGeneratedDescription =
        draft.milestones[0].description === generated?.milestones[0]?.description ||
        /^Repayment milestone 1 \(\d+(\.\d+)?%\)$/.test(draft.milestones[0].description)
      patchFirstMilestone({
        amount,
        ...(stillGeneratedDescription ? { description: `Repayment milestone 1 (${percent}%)` } : {}),
      })
    },
    [draft, generated, patchFirstMilestone],
  )

  const patchMilestoneAmount = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return
      if (draft && amount > draft.repayment.totalGrossed) return
      patchFirstMilestone({ amount })
    },
    [draft, patchFirstMilestone],
  )

  const applyReceiverOverride = useCallback(
    (receiver: string | null) => {
      setDraft((current) => {
        if (!current) return current
        const fallback = current.sourceInvestor
        return applyOneTimeReceiverOverride(current, receiver ?? fallback)
      })
    },
    [],
  )

  const patchTitle = useCallback((title: string) => {
    setDraft((current) => (current ? { ...current, title } : current))
  }, [])

  const patchDescription = useCallback((description: string) => {
    setDraft((current) => (current ? { ...current, description } : current))
  }, [])

  const patchRole = useCallback((role: EditableRoleKey, value: string) => {
    setDraft((current) => {
      if (!current) return current
      const roles: { -readonly [K in keyof RepaymentRoles]: RepaymentRoles[K] } = {
        ...current.roles,
      }
      roles[role] = value
      return { ...current, roles }
    })
  }, [])

  const resetToGenerated = useCallback(() => {
    if (!generated) return
    setRolesConfirmed(false)
    setStaleFields(null)
    setDraft(generated)
  }, [generated])

  const cancelEdits = useCallback(() => {
    resetToGenerated()
    setStage('review')
  }, [resetToGenerated])

  const revalidateForConfirm = useCallback(async (): Promise<RevalidationResult | null> => {
    if (!draft) return null
    setChecking(true)
    try {
      const result = await revalidateAuthoritativeState(
        draft,
        item.dealId,
        buildRepaymentConfigSnapshot(),
      )
      if (result.status === 'stale') {
        setStaleFields(result.changedFields)
        return result
      }
      setStaleFields(null)
      return result
    } finally {
      setChecking(false)
    }
  }, [draft, item.dealId])

  const applyExternalRevalidation = useCallback((result: RevalidationResult) => {
    if (result.status === 'stale') setStaleFields(result.changedFields)
    else setStaleFields(null)
  }, [])

  return {
    generated,
    draft,
    buildError,
    stage,
    setStage,
    validation,
    roleValidation,
    changes,
    percentFromAmount,
    staleFields,
    rolesConfirmed,
    setRolesConfirmed,
    checking,
    build,
    resetToGenerated,
    cancelEdits,
    patchTitle,
    patchDescription,
    patchMilestoneDescription,
    patchMilestonePercent,
    patchMilestoneAmount,
    applyReceiverOverride,
    patchRole,
    revalidateForConfirm,
    applyExternalRevalidation,
  }
}
