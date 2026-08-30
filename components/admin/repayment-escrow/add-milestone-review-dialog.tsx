'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, CircleAlert, Pencil, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import type { PendingApprovalItem } from '@/lib/admin/types'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import { roundUsdc } from '@/lib/deals/repayment-escrow-helpers'
import { repaymentRemainingAmount } from '@/lib/deals/fees'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { recordRepaymentEscrowAction } from '@/lib/trustless/repayment-action-audit'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

export type AddMilestoneReviewDialogProps = {
  readonly item: PendingApprovalItem
  readonly escrow: GetEscrowsFromIndexerResponse | undefined
  readonly signerAddress: string
  readonly onSubmit: (params: { description: string; amount: number; receiver: string }) => Promise<void>
  readonly triggerDisabled?: boolean
}

type ReviewStage = 'edit' | 'confirm'

export function AddMilestoneReviewDialog({
  item,
  escrow,
  signerAddress,
  onSubmit,
  triggerDisabled = false,
}: AddMilestoneReviewDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<ReviewStage>('edit')
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [receiver, setReceiver] = useState('')

  const existingMilestones = escrow?.milestones ?? []
  const totalGrossed = item.dealAmount
  const scheduled = existingMilestones.map((m) => Number((m as unknown as { amount: number }).amount ?? 0))
  const remaining = repaymentRemainingAmount(totalGrossed, scheduled)
  const proposedRemaining = useMemo(() => item.remainingToSchedule ?? remaining, [item.remainingToSchedule, remaining])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSubmitting(false)
      setChecking(false)
      return
    }
    const defaultReceiver = (existingMilestones[0] as unknown as { receiver?: string })?.receiver ?? ''
    setDescription(`Repayment milestone ${existingMilestones.length + 1}`)
    setAmountText(String(proposedRemaining > 0 ? proposedRemaining : ''))
    setReceiver(defaultReceiver)
    setStage('edit')
    setChecking(false)
  }

  const amount = Number.parseFloat(amountText.replace(',', '.'))
  const amountValid = Number.isFinite(amount) && amount > 0 && amount <= proposedRemaining + 0.01 && Math.abs(amount - roundUsdc(amount)) < 1e-9
  const receiverValid = isLikelyStellarAddress(receiver.trim())
  const canConfirm = description.trim().length > 2 && amountValid && receiverValid && !submitting && !checking

  const handleRequestConfirm = async () => {
    if (!canConfirm || checking) return
    setChecking(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      await recordRepaymentEscrowAction({
        dealId: item.dealId,
        actionType: 'milestone_update_reviewed',
        adminUserId: data.user?.id ?? null,
        signingWallet: signerAddress,
        contractId: item.escrowContractAddress,
        generatedPayload: { existingMilestones, totalGrossed, remaining: proposedRemaining },
        reviewedPayload: { description: description.trim(), amount: roundUsdc(amount), receiver: receiver.trim(), contractId: item.escrowContractAddress },
        changedFields: ['newMilestone'],
        reviewTimestamp: new Date().toISOString(),
        submissionTimestamp: null,
        completionTimestamp: null,
        transactionHash: null,
        failureMessage: null,
      })
    } catch {
      // best-effort
    } finally {
      setChecking(false)
    }
    setStage('confirm')
  }

  const handleSubmit = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    try {
      await onSubmit({ description: description.trim(), amount: roundUsdc(amount), receiver: receiver.trim() })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('repaymentEscrow.addMilestone.signing'))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={triggerDisabled}>
          <Plus className="mr-1 h-4 w-4" aria-hidden /> {t('repaymentEscrow.addMilestone.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stage === 'confirm' ? <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
            {stage === 'confirm' ? t('repaymentEscrow.addMilestone.titleConfirm') : t('repaymentEscrow.addMilestone.titleReview')}
          </DialogTitle>
          <DialogDescription>
            {stage === 'confirm' ? t('repaymentEscrow.addMilestone.descConfirm') : t('repaymentEscrow.addMilestone.descReview')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-1 rounded-md border border-border p-3 text-sm">
            <h3 className="font-semibold">{t('repaymentEscrow.addMilestone.existingTitle')}</h3>
            <CopyableCodeLine value={item.escrowContractAddress} label={t('repaymentEscrow.addMilestone.contractId')} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{t('repaymentEscrow.addMilestone.totalGrossed')}</span>
              <span className="font-medium tabular-nums">{totalGrossed.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{t('repaymentEscrow.addMilestone.remaining')}</span>
              <span className="font-medium tabular-nums">{proposedRemaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{t('repaymentEscrow.addMilestone.signer')}</span>
              <code className="max-w-[14rem] truncate font-mono text-xs" title={signerAddress}>{signerAddress}</code>
            </div>
            <Separator className="my-2" />
            <p className="text-xs font-medium text-muted-foreground">{t('repaymentEscrow.addMilestone.milestonesCount', { count: existingMilestones.length })}</p>
            <ul className="space-y-1 text-xs">
              {existingMilestones.length === 0 ? (
                <li className="text-muted-foreground">{t('repaymentEscrow.addMilestone.noCache')}</li>
              ) : (
                existingMilestones.map((m, idx) => {
                  const mm = m as unknown as { description?: string; amount?: number; status?: string; flags?: unknown }
                  return (
                    <li key={idx} className="flex items-baseline justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                      <span className="truncate">{mm.description ?? `${t('repaymentEscrow.addMilestone.newMilestone')} ${idx + 1}`}</span>
                      <span className="shrink-0 tabular-nums">{Number(mm.amount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
                      <Badge variant="secondary" className="text-[10px]">{String(mm.status ?? '—')}</Badge>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          {stage === 'edit' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="add-milestone-desc">{t('repaymentEscrow.addMilestone.newDescLabel')}</Label>
                <Input id="add-milestone-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Repayment milestone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-milestone-amount">{t('repaymentEscrow.addMilestone.newAmountLabel')}</Label>
                <Input id="add-milestone-amount" type="number" min="0.01" step="0.01" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
                {amountText && !amountValid && (
                  <p className="flex items-start gap-2 text-xs text-destructive"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0" /> {t('repaymentEscrow.addMilestone.amountInvalid', { remaining: proposedRemaining.toFixed(2) })}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-milestone-receiver">{t('repaymentEscrow.addMilestone.newReceiverLabel')}</Label>
                <Input id="add-milestone-receiver" className="font-mono text-xs" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="G..." />
                {receiver && !receiverValid && <p className="text-xs text-destructive">{t('repaymentEscrow.addMilestone.invalidReceiver')}</p>}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>{t('repaymentEscrow.addMilestone.cancel')}</Button>
                <Button type="button" onClick={handleRequestConfirm} disabled={!canConfirm}>{t('repaymentEscrow.addMilestone.reviewConfirm')}</Button>
              </DialogFooter>
            </>
          )}

          {stage === 'confirm' && (
            <>
              <section className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">{t('repaymentEscrow.addMilestone.finalPayloadTitle')}</p>
                <div className="space-y-1 font-mono text-xs">
                  <div>{t('repaymentEscrow.addMilestone.contract')}: <span className="break-all">{item.escrowContractAddress}</span></div>
                  <div>{t('repaymentEscrow.addMilestone.signerLabel')}: <span className="break-all">{signerAddress}</span></div>
                  <div>{t('repaymentEscrow.addMilestone.newMilestone')}: {description} · {Number.isFinite(amount) ? amount.toFixed(2) : '—'} USDC → {receiver || '—'}</div>
                  <div>{t('repaymentEscrow.addMilestone.totalAfter')}: {existingMilestones.length + 1}</div>
                </div>
              </section>
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.addMilestone.immutableNote')}</p>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setStage('edit')} disabled={submitting}>{t('repaymentEscrow.addMilestone.backToEdit')}</Button>
                <Button type="button" onClick={handleSubmit} disabled={!canConfirm || submitting}>
                  {submitting ? t('repaymentEscrow.addMilestone.signing') : t('repaymentEscrow.addMilestone.signAndSubmit')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setDescription(`Repayment milestone ${existingMilestones.length + 1}`); setAmountText(String(proposedRemaining)); }}>
                  <RotateCcw className="mr-1 h-3 w-3" /> {t('repaymentEscrow.addMilestone.restoreRemaining')}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
