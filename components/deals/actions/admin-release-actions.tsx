'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import {
  canWalletSignSorobanTx,
  getWalletCapabilityLimitation,
} from '@/lib/mercato-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { useOptionalDealRepaymentController } from '@/components/deals/deal-repayment-panel'
import {
  computeRepaymentState,
  canRelease as canReleaseCheck,
  canAddMilestone as canAddMilestoneCheck,
} from '@/lib/deals/repayment-eligibility'

export interface AdminReleaseActionsProps {
  deal: Deal
  onCommandComplete?: () => Promise<void>
}

export function AdminReleaseActions({
  deal,
  onCommandComplete,
}: AdminReleaseActionsProps) {
  const { t } = useI18n()
  const { walletInfo, isConnected, provider } = useWallet()
  const controller = useOptionalDealRepaymentController()
  const fallbackEscrow = useRepaymentEscrow()
  const [localBusy, setLocalBusy] = useState(false)
  const localLockRef = useRef(false)
  const [addAmount, setAddAmount] = useState('')

  const { status, currentMilestone, remainingToSchedule } = controller
    ? controller.state
    : computeRepaymentState(deal)
  const canRelease = canReleaseCheck(
    true,
    walletInfo?.address,
    deal.escrowAddress,
    currentMilestone,
    status,
  )
  const canAddMilestone = canAddMilestoneCheck(
    true,
    walletInfo?.address,
    deal.escrowAddress,
    remainingToSchedule,
    status,
  )

  const canSignSoroban = canWalletSignSorobanTx(provider)
  const capabilityWarning = isConnected ? getWalletCapabilityLimitation(provider) : null

  const approveAndReleaseMilestone = controller
    ? controller.escrow.approveAndReleaseMilestone
    : fallbackEscrow.approveAndReleaseMilestone
  const addRepaymentMilestone = controller
    ? controller.escrow.addRepaymentMilestone
    : fallbackEscrow.addRepaymentMilestone
  const working = controller
    ? controller.working || localBusy
    : localBusy || fallbackEscrow.isWorking

  const runTask = async (task: () => Promise<void>) => {
    if (controller) {
      await controller.runExclusive(task)
      return
    }
    if (localLockRef.current) return
    localLockRef.current = true
    setLocalBusy(true)
    try {
      await task()
    } finally {
      localLockRef.current = false
      setLocalBusy(false)
    }
  }

  const notifyComplete = async () => {
    if (onCommandComplete) {
      await onCommandComplete()
    } else if (controller) {
      await controller.refreshAfterCommand()
    }
  }

  const handleRelease = async () => {
    if (!walletInfo?.address || !deal.escrowAddress || !currentMilestone) return
    if (!canSignSoroban) {
      if (capabilityWarning) toast.error(capabilityWarning)
      return
    }
    await runTask(async () => {
      try {
        await approveAndReleaseMilestone({
          dealId: deal.id,
          contractId: deal.escrowAddress!,
          releaseSigner: walletInfo.address,
          milestoneIndex: currentMilestone.index,
          provider,
        })
        await notifyComplete()
        toast.success(t('dealDetail.repaymentReleased'))
      } catch (err) {
        console.error(err)
        toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentReleaseFail'))
      }
    })
  }

  const handleAddMilestone = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
    if (!canSignSoroban) {
      if (capabilityWarning) toast.error(capabilityWarning)
      return
    }
    const parsed = Number.parseFloat(addAmount || String(remainingToSchedule))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('dealDetail.repaymentAddAmountInvalid'))
      return
    }
    await runTask(async () => {
      try {
        await addRepaymentMilestone({
          dealId: deal.id,
          contractId: deal.escrowAddress!,
          adminAddress: walletInfo.address,
          amount: parsed,
          provider,
        })
        await notifyComplete()
        setAddAmount('')
        toast.success(t('dealDetail.repaymentMilestoneAdded'))
      } catch (err) {
        console.error(err)
        toast.error(
          err instanceof Error ? err.message : t('dealDetail.repaymentAddMilestoneFail'),
        )
      }
    })
  }

  return (
    <>
      {capabilityWarning && (canRelease || (canAddMilestone && remainingToSchedule > 0)) ? (
        <p className="text-xs text-muted-foreground">{capabilityWarning}</p>
      ) : null}

      {canRelease ? (
        <Button
          type="button"
          onClick={handleRelease}
          disabled={working || !isConnected || !canSignSoroban}
          className="w-full"
        >
          {working
            ? t('dealDetail.repaymentReleasing')
            : t('dealDetail.repaymentReleaseMilestoneCta', {
                index: (currentMilestone?.index ?? 0) + 1,
                amount: formatCurrency(currentMilestone?.amount ?? 0),
              })}
        </Button>
      ) : null}

      {canAddMilestone && remainingToSchedule > 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium">{t('dealDetail.repaymentAddMilestoneTitle')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="repayment-add-amount">
              {t('dealDetail.repaymentAddAmountLabel')}
            </Label>
            <Input
              id="repayment-add-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder={String(remainingToSchedule)}
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddMilestone}
            disabled={working || !isConnected || !canSignSoroban}
            className="w-full"
          >
            {working
              ? t('dealDetail.repaymentAddingMilestone')
              : t('dealDetail.repaymentAddMilestoneCta', {
                  amount: formatCurrency(
                    Number.parseFloat(addAmount) || remainingToSchedule,
                  ),
                })}
          </Button>
        </div>
      ) : null}
    </>
  )
}
