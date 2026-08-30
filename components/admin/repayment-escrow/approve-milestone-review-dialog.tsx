'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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
import { getMilestone, isMilestoneApproved } from '@/lib/admin/milestone-flags'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { useI18n } from '@/lib/i18n/provider'

type ApproveItem = PendingApprovalItem | ReleaseFallbackItem

export type ApproveMilestoneReviewDialogProps = {
  readonly item: ApproveItem
  readonly escrow: GetEscrowsFromIndexerResponse | undefined
  readonly signerAddress: string
  readonly onApprove: (params: { dealId: string; contractId: string; milestoneIndex: number }) => Promise<void>
  readonly triggerDisabled?: boolean
}

export function ApproveMilestoneReviewDialog({
  item,
  escrow,
  signerAddress,
  onApprove,
  triggerDisabled = false,
}: ApproveMilestoneReviewDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const milestone = getMilestone(escrow, item.milestoneIndex) as unknown as { amount?: number; status?: string; receiver?: string } | undefined
  const alreadyApproved = isMilestoneApproved(escrow, item.milestoneIndex)
  const balance = Number(escrow?.balance ?? 0)

  const handleApprove = async () => {
    if (!item.escrowContractAddress) {
      toast.error(t('repaymentEscrow.approve.contractMissing'))
      return
    }
    if (alreadyApproved) {
      toast.error(t('repaymentEscrow.approve.alreadyApproved'))
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      await recordRepaymentEscrowAction({
        dealId: item.dealId,
        actionType: 'milestone_approval_reviewed',
        adminUserId: data.user?.id ?? null,
        signingWallet: signerAddress,
        contractId: item.escrowContractAddress,
        generatedPayload: { milestone: milestone ?? null, balance },
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
      await onApprove({ dealId: item.dealId, contractId: item.escrowContractAddress, milestoneIndex: item.milestoneIndex })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('repaymentEscrow.approve.signing'))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={triggerDisabled || alreadyApproved}>
          <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden /> {t('repaymentEscrow.approve.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> {t('repaymentEscrow.approve.title')}
          </DialogTitle>
          <DialogDescription>{t('repaymentEscrow.approve.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <CopyableCodeLine value={item.escrowContractAddress} label={t('repaymentEscrow.approve.contractId')} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.approve.milestone')}</p>
              <p className="font-medium">#{item.milestoneIndex + 1} · {item.milestoneTitle}</p>
              {milestone?.receiver && <code className="block truncate font-mono text-xs" title={milestone.receiver}>{milestone.receiver}</code>}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.approve.amount')}</p>
              <p className="font-medium tabular-nums">{item.milestoneAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC · {item.milestonePercentage}%</p>
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.approve.status')}: {milestone?.status ?? '—'} {alreadyApproved && <Badge className="ml-1 text-[10px]">{t('repaymentEscrow.approve.alreadyApproved')}</Badge>}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{t('repaymentEscrow.approve.balance')}</span>
            <span className="font-medium tabular-nums">{balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{t('repaymentEscrow.approve.requiredSigner')}</span>
            <code className="max-w-[14rem] truncate font-mono text-xs" title={signerAddress}>{signerAddress}</code>
          </div>
          <p className="text-xs text-muted-foreground">{t('repaymentEscrow.approve.note')}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>{t('repaymentEscrow.approve.cancel')}</Button>
          <Button type="button" onClick={handleApprove} disabled={alreadyApproved || submitting}>
            {submitting ? t('repaymentEscrow.approve.signing') : t('repaymentEscrow.approve.approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
