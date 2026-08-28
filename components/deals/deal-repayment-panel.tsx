'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { useRepaymentCommandRefresh } from '@/hooks/use-repayment-command-refresh'
import {
  computeRepaymentState,
  canFund as canFundCheck,
  canRelease as canReleaseCheck,
  canAddMilestone as canAddMilestoneCheck,
} from '@/lib/deals/repayment-eligibility'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { stellarExpertContractUrl } from '@/lib/stellar/explorer'
import { Badge } from '@/components/ui/badge'

interface DealRepaymentPanelProps {
  deal: Deal
  isPyme: boolean
  isAdmin: boolean
  isInvestor?: boolean
  indexerEscrow?: GetEscrowsFromIndexerResponse | null
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function DealRepaymentPanel({
  deal,
  isPyme,
  isAdmin,
  isInvestor = false,
  indexerEscrow = null,
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
    syncDealFromIndexer,
  } = useRepaymentEscrow()
  const [busy, setBusy] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const backgroundSyncDone = useRef(false)

  const refreshDeal = useCallback(async () => {
    const updated = await fetchDeal()
    if (updated) onDealUpdate(updated)
  }, [fetchDeal, onDealUpdate])
  const { refreshAfterCommand } = useRepaymentCommandRefresh(refreshDeal)

  const {
    status,
    displayStatus,
    milestones,
    currentMilestone,
    escrowAmount,
    openAmount,
    remainingToSchedule,
    defaultFundAmount,
    breakdown,
  } = computeRepaymentState(deal)

  const canFund = canFundCheck(isPyme, deal.escrowAddress, status)
  const canRelease = canReleaseCheck(
    isAdmin,
    walletInfo?.address,
    deal.escrowAddress,
    currentMilestone,
    status,
  )
  const canAddMilestone = canAddMilestoneCheck(
    isAdmin,
    walletInfo?.address,
    deal.escrowAddress,
    remainingToSchedule,
    status,
  )

  useEffect(() => {
    if (!deal.escrowAddress || backgroundSyncDone.current) return
    backgroundSyncDone.current = true
    void syncDealFromIndexer(deal.id, deal.escrowAddress, undefined, {
      retryOnEmptyMilestones: false,
    })
      .then(() => refreshAfterCommand())
      .catch(() => {
        // Non-blocking; user can refresh manually
      })
  }, [deal.id, deal.escrowAddress, syncDealFromIndexer, refreshAfterCommand])

  if (deal.status === 'awaiting_funding') return null

  const handleRefreshStatus = async () => {
    if (!deal.escrowAddress) return
    setBusy(true)
    try {
      await syncDealFromIndexer(deal.id, deal.escrowAddress, undefined, {
        retryOnEmptyMilestones: true,
      })
      await refreshAfterCommand()
      toast.success(t('dealDetail.repaymentRefreshSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.repaymentRefreshFail'),
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
      await refreshAfterCommand()
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
      await refreshAfterCommand()
      toast.success(t('dealDetail.repaymentReleased'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentReleaseFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleAddMilestone = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
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
        amount: parsed,
        provider,
      })
      await refreshAfterCommand()
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
  const duePending = !deal.repaymentDueAt && !deal.deliveredAt
  const liveBalance = Number(indexerEscrow?.balance ?? 0)
  const progressTarget =
    openAmount > 0 ? openAmount : currentMilestone?.amount ?? defaultFundAmount
  const progressPct =
    progressTarget > 0 ? Math.min(100, (liveBalance / progressTarget) * 100) : 0
  const showEscrowProgress =
    Boolean(deal.escrowAddress) &&
    status !== 'none' &&
    status !== 'order_confirmed'
  const showInvestorProgress = isInvestor && showEscrowProgress

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t('dealDetail.repaymentTitle')}</CardTitle>
          <CardDescription>{t('dealDetail.repaymentDescription')}</CardDescription>
        </div>
        {deal.escrowAddress ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleRefreshStatus}
            disabled={working}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${working ? 'animate-spin' : ''}`} aria-hidden />
            {working ? t('dealDetail.repaymentRefreshing') : t('dealDetail.repaymentRefreshStatus')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showInvestorProgress ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.repaymentInvestorReadOnlyHint')}
          </p>
        ) : null}

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('dealDetail.repaymentBreakdownTitle')}
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dealDetail.principal')}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(breakdown.principal)} USDC
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dealDetail.repaymentInterest')}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(breakdown.interest)} USDC
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5">
              <span className="font-medium">{t('dealDetail.repaymentEscrowTotalShort')}</span>
              <span className="tabular-nums font-semibold">
                {formatCurrency(escrowAmount)} USDC
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dealDetail.investorPayout')}</span>
              <span className="tabular-nums font-medium text-success">
                {formatCurrency(breakdown.investorPayout)} USDC
              </span>
            </li>
          </ul>
        </div>

        {showEscrowProgress ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('dealDetail.repaymentEscrowBalance')}
              </p>
              <p className="tabular-nums font-semibold">
                {formatCurrency(liveBalance)} USDC
              </p>
            </div>
            {progressTarget > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t('dealDetail.repaymentFundingProgress')}</span>
                  <span className="tabular-nums">
                    {formatCurrency(liveBalance)} / {formatCurrency(progressTarget)} USDC
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('dealDetail.repaymentFundingProgress')}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('dealDetail.repaymentFundingProgressHint', {
                    percent: Math.round(progressPct),
                  })}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {deal.repaymentDueAt ? (
            <div>
              <p className="text-muted-foreground">{t('dealDetail.repaymentDue')}</p>
              <p className="font-medium">{formatDate(deal.repaymentDueAt)}</p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">{t('dealDetail.repaymentDue')}</p>
              <p className="font-medium text-muted-foreground">
                {duePending
                  ? t('dealDetail.repaymentDuePendingDelivery')
                  : t('dealDetail.repaymentDuePending')}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">{t('dealDetail.repaymentStatusLabel')}</p>
            <p className="font-medium capitalize">{displayStatus.replaceAll('_', ' ')}</p>
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

        {status === 'none' ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.repaymentAwaitingDelivery')}
          </p>
        ) : null}

        {status === 'order_confirmed' && isPyme ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.repaymentAwaitingAdminEscrow')}
          </p>
        ) : null}

        {status === 'order_confirmed' && isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {t('dealDetail.repaymentAdminCreateHint')}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/approvals">
                {t('dealDetail.repaymentAdminApprovalsLink')}
              </Link>
            </Button>
          </div>
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
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('dealDetail.escrowContract')}
            </p>
            <a
              href={stellarExpertContractUrl(deal.escrowAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 break-all font-mono text-xs text-primary hover:underline"
            >
              {deal.escrowAddress}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
