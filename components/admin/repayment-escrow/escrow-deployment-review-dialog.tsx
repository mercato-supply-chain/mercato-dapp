'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CircleAlert, Pencil, RotateCcw, Rocket } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useRepaymentDeploymentDraft } from '@/hooks/use-repayment-deployment-draft'
import type { CreateEscrowItem } from '@/lib/admin/types'
import { compareRepaymentEscrowDrafts, type RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import type { RevalidationResult } from '@/lib/trustless/repayment-deployment-guard'
import { recordRepaymentEscrowAction } from '@/lib/trustless/repayment-action-audit'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

import { EscrowActionConfirmation } from './escrow-action-confirmation'
import { EscrowDealSummary } from './escrow-deal-summary'
import { EscrowFeeSummary } from './escrow-fee-summary'
import { EscrowIdentityFields } from './escrow-identity-fields'
import { EscrowMilestoneEditor } from './escrow-milestone-editor'
import { EscrowPayloadDiff } from './escrow-payload-diff'
import { EscrowRoleFields } from './escrow-role-fields'

export function buildDeploymentAuditPayload(
  generated: RepaymentEscrowDeploymentDraft | null,
  reviewTimestamp: string,
): { generated: RepaymentEscrowDeploymentDraft | null; reviewTimestamp: string } {
  return { generated, reviewTimestamp }
}

export type EscrowDeploymentReviewDialogProps = {
  readonly item: CreateEscrowItem
  readonly signerAddress: string
  readonly initialMode?: 'review' | 'edit'
  readonly onSubmitReviewed?: (draft: RepaymentEscrowDeploymentDraft, audit?: { generated: RepaymentEscrowDeploymentDraft | null; reviewTimestamp: string | null }) => Promise<void>
  readonly onRevalidate?: (draft: RepaymentEscrowDeploymentDraft) => Promise<RevalidationResult>
  readonly triggerDisabled?: boolean
}

export function EscrowDeploymentReviewDialog({
  item,
  signerAddress,
  initialMode = 'review',
  onSubmitReviewed,
  onRevalidate,
  triggerDisabled = false,
}: EscrowDeploymentReviewDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    generated,
    draft,
    buildError,
    stage,
    setStage,
    validation,
    roleValidation,
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
  } = useRepaymentDeploymentDraft({ item, signerAddress, initialMode })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSubmitting(false)
      return
    }
    build()
  }

  useEffect(() => {
    if (!open) setSubmitting(false)
  }, [open])

  const firstMilestone = draft?.milestones[0] ?? null

  const handleSubmitReviewed = async () => {
    if (!draft || !generated || submitting || !onSubmitReviewed) return
    setSubmitting(true)
    try {
      await onSubmitReviewed(draft, buildDeploymentAuditPayload(generated, new Date().toISOString()))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('repaymentEscrow.deploy.buildError')
      const stale = (error as Error & { changedFields?: unknown; code?: string }).changedFields
      if (Array.isArray(stale) && stale.length > 0) {
        toast.error(t('repaymentEscrow.deploy.staleRegenerate'))
      } else {
        toast.error(message)
      }
      setSubmitting(false)
      setStage('review')
      return
    }
    setOpen(false)
  }

  const handleRequestConfirm = async () => {
    if (!draft || !generated || checking) return

    const result: RevalidationResult | null = await (async () => {
      if (onRevalidate) {
        try {
          const r = await onRevalidate(draft)
          applyExternalRevalidation(r)
          return r
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t('adminPending.resyncFail'))
          return null
        }
      }
      try {
        return await revalidateForConfirm()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('adminPending.resyncFail'))
        return null
      }
    })()

    if (!result) return
    if (result.status === 'stale') {
      toast.error(t('repaymentEscrow.deploy.staleToast'))
      return
    }
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      await recordRepaymentEscrowAction({
        dealId: item.dealId,
        actionType: 'deployment_reviewed',
        adminUserId: data.user?.id ?? null,
        signingWallet: signerAddress,
        contractId: null,
        generatedPayload: generated,
        reviewedPayload: draft,
        changedFields: compareRepaymentEscrowDrafts(generated, draft).map((c) => c.path),
        reviewTimestamp: new Date().toISOString(),
        submissionTimestamp: null,
        completionTimestamp: null,
        transactionHash: null,
        failureMessage: null,
      })
    } catch {
      // best-effort
    }
    setStage('confirm')
  }

  const confirmDisabled =
    !validation?.ok ||
    staleFields !== null ||
    Boolean(roleValidation?.requiresAdditionalConfirmation && !rolesConfirmed) ||
    !onSubmitReviewed ||
    submitting ||
    checking

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" disabled={triggerDisabled}>
          {t('repaymentEscrow.deploy.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {buildError ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('repaymentEscrow.deploy.titleReview')}</DialogTitle>
              <DialogDescription>{t('repaymentEscrow.deploy.prepareErrorTitle')}</DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-destructive">{buildError}</p>
            </div>
          </div>
        ) : draft && generated ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {stage === 'confirm' ? (
                  <Rocket className="h-4 w-4" aria-hidden />
                ) : stage === 'edit' ? (
                  <Pencil className="h-4 w-4" aria-hidden />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                )}
                {stage === 'confirm'
                  ? t('repaymentEscrow.deploy.titleConfirm')
                  : stage === 'edit'
                    ? t('repaymentEscrow.deploy.titleEdit')
                    : t('repaymentEscrow.deploy.titleReview')}
              </DialogTitle>
              <DialogDescription>
                {stage === 'confirm'
                  ? t('repaymentEscrow.deploy.descConfirm')
                  : stage === 'edit'
                    ? t('repaymentEscrow.deploy.descEdit')
                    : t('repaymentEscrow.deploy.descReview')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {stage === 'review' && (
                <>
                  {staleFields && staleFields.length > 0 && (
                    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                      <p className="flex items-start gap-2 font-medium text-destructive">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {t('repaymentEscrow.deploy.staleTitle')}
                      </p>
                      <ul className="space-y-0.5 font-mono text-xs">
                        {staleFields.map((field) => (
                          <li key={field.field} className="break-all">
                            <span className="text-muted-foreground">{field.field}:</span> {field.reviewed} →{' '}
                            <span className="font-medium">{field.authoritative}</span>
                          </li>
                        ))}
                      </ul>
                      <Button type="button" variant="outline" size="sm" onClick={build}>
                        {t('repaymentEscrow.deploy.syncBtn')}
                      </Button>
                    </div>
                  )}

                  <EscrowDealSummary item={item} draft={draft} />
                  <Separator />
                  <EscrowIdentityFields
                    draft={draft}
                    generated={generated}
                    editing={false}
                    onTitleChange={patchTitle}
                    onDescriptionChange={patchDescription}
                  />
                  <EscrowRoleFields
                    draft={draft}
                    generated={generated}
                    editing={false}
                    onRoleChange={patchRole}
                  />
                  <EscrowFeeSummary draft={draft} />

                  {firstMilestone && (
                    <section className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
                      <h3 className="text-sm font-semibold">
                        {t('repaymentEscrow.deploy.milestoneTitle', { percent: percentFromAmount.toFixed(1) })}
                      </h3>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.deploy.milestoneDescLabel')}</span>
                        <span className="min-w-0 truncate text-right font-medium">{firstMilestone.description}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.deploy.milestoneAmountLabel')}</span>
                        <span className="min-w-0 truncate text-right font-medium tabular-nums">
                          {firstMilestone.amount.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          USDC
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.deploy.milestoneReceiverLabel')}</span>
                        <code className="min-w-0 truncate text-right font-mono text-xs">{firstMilestone.receiver}</code>
                      </div>
                    </section>
                  )}

                  <EscrowPayloadDiff generated={generated} reviewed={draft} />

                  {validation && !validation.ok && (
                    <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {validation.errors.map((error) => (
                        <li key={error.code} className="flex items-start gap-2">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{error.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setStage('edit')}>
                      <Pencil className="h-4 w-4" aria-hidden /> {t('repaymentEscrow.deploy.editBtn')}
                    </Button>
                    <Button type="button" onClick={handleRequestConfirm} disabled={confirmDisabled || checking}>
                      {checking ? t('repaymentEscrow.deploy.approving') : t('repaymentEscrow.deploy.approveConfirm')}
                    </Button>
                  </DialogFooter>
                </>
              )}

              {stage === 'edit' && (
                <>
                  <EscrowIdentityFields
                    draft={draft}
                    generated={generated}
                    editing
                    onTitleChange={patchTitle}
                    onDescriptionChange={patchDescription}
                  />
                  <EscrowRoleFields draft={draft} generated={generated} editing onRoleChange={patchRole} />
                  {firstMilestone && (
                    <EscrowMilestoneEditor
                      totalGrossed={draft.repayment.totalGrossed}
                      milestoneDescription={firstMilestone.description}
                      milestoneAmount={firstMilestone.amount}
                      percent={percentFromAmount}
                      generatedReceiver={generated?.milestones[0]?.receiver ?? ''}
                      receiver={firstMilestone.receiver}
                      onDescriptionChange={patchMilestoneDescription}
                      onPercentChange={patchMilestonePercent}
                      onAmountChange={patchMilestoneAmount}
                      onReceiverOverride={applyReceiverOverride}
                    />
                  )}
                  <EscrowPayloadDiff generated={generated} reviewed={draft} />
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="ghost" onClick={resetToGenerated}>
                      <RotateCcw className="h-4 w-4" aria-hidden /> {t('repaymentEscrow.deploy.resetGenerated')}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdits}>
                      {t('repaymentEscrow.deploy.cancel')}
                    </Button>
                    <Button type="button" onClick={() => setStage('review')}>
                      {t('repaymentEscrow.deploy.backToReview')}
                    </Button>
                  </DialogFooter>
                </>
              )}

              {stage === 'confirm' && (
                <EscrowActionConfirmation
                  item={item}
                  generated={generated}
                  reviewed={draft}
                  warnings={validation?.warnings ?? []}
                  requiresRolesConfirmation={roleValidation?.requiresAdditionalConfirmation ?? false}
                  rolesConfirmed={rolesConfirmed}
                  onRolesConfirmedChange={setRolesConfirmed}
                  submitting={submitting}
                  confirmDisabled={confirmDisabled}
                  onBack={() => setStage('review')}
                  onConfirm={handleSubmitReviewed}
                />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
