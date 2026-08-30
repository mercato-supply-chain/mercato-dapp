'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { recordRepaymentEscrowAction } from '@/lib/trustless/repayment-action-audit'
import { createClient } from '@/lib/supabase/client'

import { Button } from '@/components/ui/button'
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
import type { PendingApprovalItem, ReleaseFallbackItem } from '@/lib/admin/types'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { getMilestone, isMilestoneApproved, isMilestoneReleased } from '@/lib/admin/milestone-flags'
import { PLATFORM_FEE_PERCENT, TW_PROTOCOL_FEE_PERCENT } from '@/lib/deals/fees'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { useI18n } from '@/lib/i18n/provider'

type ReleaseItem = PendingApprovalItem | ReleaseFallbackItem

export type ReleaseMilestoneReviewDialogProps = {
  readonly item: ReleaseItem
  readonly escrow: GetEscrowsFromIndexerResponse | undefined
  readonly signerAddress: string
  readonly onRelease: (params: { dealId: string; contractId: string; milestoneIndex: number }) => Promise<void>
  readonly triggerDisabled?: boolean
}

export function ReleaseMilestoneReviewDialog({
  item,
  escrow,
  signerAddress,
  onRelease,
  triggerDisabled = false,
}: ReleaseMilestoneReviewDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const milestone = getMilestone(escrow, item.milestoneIndex) as unknown as { amount?: number; status?: string } | undefined
  const alreadyReleased = isMilestoneReleased(escrow, item.milestoneIndex)
  const alreadyApproved = isMilestoneApproved(escrow, item.milestoneIndex)
  const balance = Number(escrow?.balance ?? 0)

  const feePreview = useMemo(() => {
    const amount = item.milestoneAmount
    const platformFee = amount * (PLATFORM_FEE_PERCENT / 100)
    const protocolFee = amount * (TW_PROTOCOL_FEE_PERCENT / 100)
    const net = Math.max(0, amount - platformFee - protocolFee)
    return { platformFee, protocolFee, net, totalFee: platformFee + protocolFee }
  }, [item.milestoneAmount])

  const canRelease = !alreadyReleased && !submitting

  const handleRelease = async () => {
    if (!item.escrowContractAddress) {
      toast.error(t('repaymentEscrow.release.contractId') + ' ' + t('repaymentEscrow.approve.contractMissing'))
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      await recordRepaymentEscrowAction({
        dealId: item.dealId,
        actionType: 'milestone_release_reviewed',
        adminUserId: data.user?.id ?? null,
        signingWallet: signerAddress,
        contractId: item.escrowContractAddress,
        generatedPayload: { milestone: milestone ?? null, balance, feePreview },
        reviewedPayload: { milestoneIndex: item.milestoneIndex, contractId: item.escrowContractAddress },
        changedFields: [],
        reviewTimestamp: new Date().toISOString(),
        submissionTimestamp: null,
        completionTimestamp: null,
        transactionHash: null,
        failureMessage: null,
      })
    } catch {
      // best-effort
    }
    try {
      await onRelease({ dealId: item.dealId, contractId: item.escrowContractAddress, milestoneIndex: item.milestoneIndex })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('repaymentEscrow.release.releasing'))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={triggerDisabled || alreadyReleased}>
          <DollarSign className="mr-2 h-4 w-4" aria-hidden /> {t('repaymentEscrow.release.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> {t('repaymentEscrow.release.title')}
          </DialogTitle>
          <DialogDescription>{t('repaymentEscrow.release.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <CopyableCodeLine value={item.escrowContractAddress} label={t('repaymentEscrow.release.contractId')} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.release.milestone')}</p>
              <p className="font-medium">#{item.milestoneIndex + 1} · {item.milestoneTitle}</p>
              <p className="font-medium tabular-nums">{item.milestoneAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC · {item.milestonePercentage}%</p>
              {milestone?.status && <Badge variant="secondary" className="text-[10px]">{milestone.status}</Badge>}
              {alreadyApproved && <Badge className="ml-1 bg-primary/10 text-[10px] text-primary">{t('repaymentEscrow.approve.alreadyApproved')}</Badge>}
              {alreadyReleased && <Badge className="ml-1 bg-success/10 text-[10px] text-success">{t('adminPending.releasedBadge')}</Badge>}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.release.balance')}</p>
              <p className="font-medium tabular-nums">{balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</p>
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.release.releaseSigner')}: <code className="font-mono" title={signerAddress}>{signerAddress.slice(0, 8)}…{signerAddress.slice(-4)}</code></p>
            </div>
          </div>
          <Separator />
          <div className="space-y-1 rounded-md border border-border p-2">
            <p className="text-xs font-semibold">{t('repaymentEscrow.release.feesTitle')}</p>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t('repaymentEscrow.release.mercatoFee')}</span>
              <span className="tabular-nums">-{feePreview.platformFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t('repaymentEscrow.release.twFee')}</span>
              <span className="tabular-nums">-{feePreview.protocolFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-border pt-1 text-xs font-medium">
              <span>{t('repaymentEscrow.release.net')}</span>
              <span className="tabular-nums">{feePreview.net.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('repaymentEscrow.release.feeNote')}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t('repaymentEscrow.release.immutableNote')}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>{t('repaymentEscrow.release.cancel')}</Button>
          <Button type="button" onClick={handleRelease} disabled={!canRelease}>
            {submitting ? t('repaymentEscrow.release.releasing') : t('repaymentEscrow.release.release')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
