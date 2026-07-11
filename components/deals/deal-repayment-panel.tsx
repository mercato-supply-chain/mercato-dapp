'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import {
  PLATFORM_FEE_PERCENT,
  repaymentEscrowAmount,
  investorPayoutAmount,
  repaymentRemainingAmount,
} from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { Badge } from '@/components/ui/badge'

type Supabase = ReturnType<typeof createClient>

interface DealRepaymentPanelProps {
  deal: Deal
  isPyme: boolean
  isAdmin: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

const FUNDABLE_STATUSES = new Set([
  'escrow_initialized',
  'funding',
  'ready_to_release',
  'partially_released',
  'funded',
])

export function DealRepaymentPanel({
  deal,
  isPyme,
  isAdmin,
  supabase,
  fetchDeal,
  onDealUpdate,
}: DealRepaymentPanelProps) {
  const { t } = useI18n()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const {
    isWorking,
    fundRepaymentEscrow,
    approveAndReleaseMilestone,
    addRepaymentMilestone,
  } = useRepaymentEscrow()
  const [busy, setBusy] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [addAmount, setAddAmount] = useState('')

  const apr = deal.yieldAPR ?? 0
  const { profit } = computeInvestorReturns(deal.priceUSDC, apr, deal.term)
  const investorPayout = investorPayoutAmount(deal.priceUSDC, profit)
  const escrowAmount =
    deal.repaymentTotalAmount && deal.repaymentTotalAmount > 0
      ? deal.repaymentTotalAmount
      : repaymentEscrowAmount(deal.priceUSDC, profit)
  const status = deal.repaymentStatus ?? 'none'
  const milestones = deal.repaymentMilestones ?? []
  const openMilestones = milestones.filter((m) => !m.released)
  const openAmount = openMilestones.reduce((sum, m) => sum + m.amount, 0)
  const scheduledAmounts = milestones.map((m) => m.amount)
  const remainingToSchedule = repaymentRemainingAmount(escrowAmount, scheduledAmounts)
  const currentMilestone = openMilestones[0]
  const defaultFundAmount =
    openAmount > 0 ? openAmount : remainingToSchedule > 0 ? remainingToSchedule : escrowAmount

  if (deal.status === 'awaiting_funding') return null

  const canFund = isPyme && Boolean(deal.escrowAddress) && FUNDABLE_STATUSES.has(status)
  const canRelease =
    (isAdmin || walletInfo?.address === MERCATO_PLATFORM_ADDRESS) &&
    Boolean(deal.escrowAddress) &&
    Boolean(currentMilestone) &&
    (status === 'ready_to_release' || status === 'funded')
  const canAddMilestone =
    (isAdmin || walletInfo?.address === MERCATO_PLATFORM_ADDRESS) &&
    Boolean(deal.escrowAddress) &&
    remainingToSchedule > 0 &&
    status !== 'none' &&
    status !== 'order_confirmed'

  const refresh = async () => {
    const updated = await fetchDeal()
    if (updated) onDealUpdate(updated)
  }

  const handleConfirmOrder = async () => {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('deals')
        .update({ repayment_status: 'order_confirmed' })
        .eq('id', deal.id)
      if (error) throw error
      await refresh()
      toast.success(t('dealDetail.repaymentOrderConfirmed'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.repaymentOrderConfirmFail'),
      )
    } finally {
      setBusy(false)
    }
  }

  const handleFund = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
    const parsed = Number.parseFloat(fundAmount || String(defaultFundAmount))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('dealDetail.repaymentFundAmountInvalid'))
      return
    }
    setBusy(true)
    try {
      await fundRepaymentEscrow({
        dealId: deal.id,
        contractId: deal.escrowAddress,
        pymeAddress: walletInfo.address,
        amount: parsed,
        provider,
      })
      await refresh()
      setFundAmount('')
      toast.success(t('dealDetail.repaymentFunded'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentFundFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleRelease = async () => {
    if (!walletInfo?.address || !deal.escrowAddress || !currentMilestone) return
    if (walletInfo.address !== MERCATO_PLATFORM_ADDRESS && !isAdmin) {
      toast.error(t('dealDetail.repaymentReleaseOnlyPlatform'))
      return
    }
    setBusy(true)
    try {
      await approveAndReleaseMilestone({
        dealId: deal.id,
        contractId: deal.escrowAddress,
        releaseSigner: walletInfo.address,
        milestoneIndex: currentMilestone.index,
        provider,
      })
      await refresh()
      toast.success(t('dealDetail.repaymentReleased'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentReleaseFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleAddMilestone = async () => {
    if (!walletInfo?.address || !deal.escrowAddress || !deal.investorAddress) return
    const parsed = Number.parseFloat(addAmount || String(remainingToSchedule))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('dealDetail.repaymentAddAmountInvalid'))
      return
    }
    setBusy(true)
    try {
      await addRepaymentMilestone({
        dealId: deal.id,
        contractId: deal.escrowAddress,
        adminAddress: walletInfo.address,
        investorAddress: deal.investorAddress,
        amount: parsed,
        provider,
      })
      await refresh()
      setAddAmount('')
      toast.success(t('dealDetail.repaymentMilestoneAdded'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.repaymentAddMilestoneFail'),
      )
    } finally {
      setBusy(false)
    }
  }

  const working = busy || isWorking

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dealDetail.repaymentTitle')}</CardTitle>
        <CardDescription>{t('dealDetail.repaymentDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{t('dealDetail.investorPayout')}</p>
            <p className="font-semibold tabular-nums">{formatCurrency(investorPayout)} USDC</p>
          </div>
          <div>
            <p className="text-muted-foreground">
              {t('dealDetail.repaymentEscrowTotal', { percent: PLATFORM_FEE_PERCENT })}
            </p>
            <p className="font-semibold tabular-nums">{formatCurrency(escrowAmount)} USDC</p>
          </div>
          {deal.repaymentDueAt ? (
            <div>
              <p className="text-muted-foreground">{t('dealDetail.repaymentDue')}</p>
              <p className="font-medium">{formatDate(deal.repaymentDueAt)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">{t('dealDetail.repaymentStatusLabel')}</p>
            <p className="font-medium capitalize">{status.replaceAll('_', ' ')}</p>
          </div>
          {currentMilestone ? (
            <div>
              <p className="text-muted-foreground">{t('dealDetail.repaymentCurrentMilestone')}</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(currentMilestone.amount)} USDC
              </p>
            </div>
          ) : null}
          {remainingToSchedule > 0 && milestones.length > 0 ? (
            <div>
              <p className="text-muted-foreground">{t('dealDetail.repaymentRemainingToSchedule')}</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(remainingToSchedule)} USDC
              </p>
            </div>
          ) : null}
        </div>

        {milestones.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            {milestones.map((m) => (
              <li key={`rm-${m.index}`} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  #{m.index + 1} · {m.description || t('dealDetail.repaymentMilestoneFallback')}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">
                    {formatCurrency(m.amount)}
                  </span>
                  <Badge variant={m.released ? 'secondary' : 'outline'} className="text-xs">
                    {m.released
                      ? t('dealDetail.repaymentMilestoneReleased')
                      : t('dealDetail.repaymentMilestoneOpen')}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {status === 'none' && isPyme ? (
          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleConfirmOrder}
              disabled={working}
              className="w-full"
            >
              {working
                ? t('dealDetail.repaymentConfirmingOrder')
                : t('dealDetail.repaymentConfirmOrderCta')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('dealDetail.repaymentConfirmOrderHint')}
            </p>
          </div>
        ) : null}

        {status === 'order_confirmed' && isPyme ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.repaymentAwaitingAdminEscrow')}
          </p>
        ) : null}

        {status === 'order_confirmed' && isAdmin ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.repaymentAdminCreateHint')}
          </p>
        ) : null}

        {canFund ? (
          <div className="space-y-3">
            {!isConnected ? (
              <Button type="button" onClick={handleConnect} className="w-full">
                {t('dealDetail.connectStellarWallet')}
              </Button>
            ) : (
              <>
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
                <Button type="button" onClick={handleFund} disabled={working} className="w-full">
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

        {canRelease ? (
          <Button type="button" onClick={handleRelease} disabled={working} className="w-full">
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
              disabled={working || !isConnected}
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

        {status === 'released' ? (
          <p className="text-sm text-success">{t('dealDetail.repaymentComplete')}</p>
        ) : null}

        {deal.escrowAddress ? (
          <p className="break-all font-mono text-xs text-muted-foreground">
            {deal.escrowAddress}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
