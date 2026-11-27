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
  canFund as canFundCheck,
} from '@/lib/deals/repayment-eligibility'

export interface PymeRepayActionsProps {
  deal: Deal
  onCommandComplete?: () => Promise<void>
}

export function PymeRepayActions({
  deal,
  onCommandComplete,
}: PymeRepayActionsProps) {
  const { t } = useI18n()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const controller = useOptionalDealRepaymentController()
  const fallbackEscrow = useRepaymentEscrow()
  const [localBusy, setLocalBusy] = useState(false)
  const localLockRef = useRef(false)
  const [fundAmount, setFundAmount] = useState('')

  const { status, defaultFundAmount } = controller
    ? controller.state
    : computeRepaymentState(deal)
  const canFund = canFundCheck(true, deal.escrowAddress, status)
  const canSignSoroban = canWalletSignSorobanTx(provider)
  const capabilityWarning = isConnected ? getWalletCapabilityLimitation(provider) : null

  const fundRepaymentEscrow = controller
    ? controller.escrow.fundRepaymentEscrow
    : fallbackEscrow.fundRepaymentEscrow
  const working = controller
    ? controller.working || localBusy
    : localBusy || fallbackEscrow.isWorking

  const handleFund = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
    if (!canSignSoroban) {
      if (capabilityWarning) toast.error(capabilityWarning)
      return
    }
    const parsed = Number.parseFloat(fundAmount || String(defaultFundAmount))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('dealDetail.repaymentFundAmountInvalid'))
      return
    }

    const execute = async () => {
      try {
        await fundRepaymentEscrow({
          dealId: deal.id,
          contractId: deal.escrowAddress!,
          pymeAddress: walletInfo.address,
          amount: parsed,
          provider,
        })
        if (onCommandComplete) {
          await onCommandComplete()
        } else if (controller) {
          await controller.refreshAfterCommand()
        }
        setFundAmount('')
        toast.success(t('dealDetail.repaymentFunded'))
      } catch (err) {
        console.error(err)
        toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentFundFail'))
      }
    }

    if (controller) {
      await controller.runExclusive(execute)
    } else {
      if (localLockRef.current) return
      localLockRef.current = true
      setLocalBusy(true)
      try {
        await execute()
      } finally {
        localLockRef.current = false
        setLocalBusy(false)
      }
    }
  }

  return (
    <>
      {status === 'order_confirmed' ? (
        <p className="text-sm text-muted-foreground">
          {t('dealDetail.repaymentAwaitingAdminEscrow')}
        </p>
      ) : null}

      {canFund ? (
        <div className="space-y-3">
          {!isConnected ? (
            <Button type="button" onClick={() => void handleConnect()} className="w-full">
              {t('dealDetail.connectStellarWallet')}
            </Button>
          ) : (
            <>
              {capabilityWarning ? (
                <p className="text-xs text-muted-foreground">{capabilityWarning}</p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="repayment-fund-amount">
                  {t('dealDetail.repaymentFundAmountLabel')}
                </Label>
                <Input
                  id="repayment-fund-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={String(defaultFundAmount)}
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('dealDetail.repaymentFundAmountHint', {
                    amount: formatCurrency(defaultFundAmount),
                  })}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleFund}
                disabled={working || !canSignSoroban}
                className="w-full"
              >
                {working
                  ? t('dealDetail.repaymentFunding')
                  : t('dealDetail.repaymentFundCta', {
                      amount: formatCurrency(
                        Number.parseFloat(fundAmount) || defaultFundAmount,
                      ),
                    })}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </>
  )
}
