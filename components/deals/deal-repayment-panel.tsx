'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { useRepaymentCommandRefresh } from '@/hooks/use-repayment-command-refresh'
import {
  computeRepaymentState,
  type RepaymentState,
} from '@/lib/deals/repayment-eligibility'
import { stellarExpertContractUrl } from '@/lib/stellar/explorer'

export interface DealRepaymentControllerValue {
  state: RepaymentState
  working: boolean
  runExclusive: (task: () => Promise<void>) => Promise<void>
  refreshAfterCommand: () => Promise<void>
  escrow: ReturnType<typeof useRepaymentEscrow>
}

const DealRepaymentContext = createContext<DealRepaymentControllerValue | null>(null)

export function useOptionalDealRepaymentController(): DealRepaymentControllerValue | null {
  return useContext(DealRepaymentContext)
}

export interface DealRepaymentPanelProps {
  deal: Deal
  indexerEscrow?: GetEscrowsFromIndexerResponse | null
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  /** Optional role-scoped notice displayed above the breakdown (e.g. investor read-only hint). */
  headerNotice?: ReactNode
  /** Role-specific repayment action slot (e.g. PymeRepayActions or AdminReleaseActions). */
  actions?: ReactNode
}

export function DealRepaymentPanel({
  deal,
  indexerEscrow = null,
  fetchDeal,
  onDealUpdate,
  headerNotice,
  actions,
}: DealRepaymentPanelProps) {
  const { t } = useI18n()
  const escrow = useRepaymentEscrow()
  const { isWorking, syncDealFromIndexer } = escrow
  const [busy, setBusy] = useState(false)
  const lockRef = useRef(false)
  const isWorkingRef = useRef(isWorking)
  const backgroundSyncedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    isWorkingRef.current = isWorking
  }, [isWorking])

  const refreshDeal = useCallback(async () => {
    const updated = await fetchDeal()
    if (updated) onDealUpdate(updated)
  }, [fetchDeal, onDealUpdate])
  const { refreshAfterCommand } = useRepaymentCommandRefresh(refreshDeal)

  const repaymentState = useMemo(() => computeRepaymentState(deal), [deal])
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
  } = repaymentState

  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (lockRef.current || isWorkingRef.current) return
    lockRef.current = true
    setBusy(true)
    try {
      await task()
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }, [])

  const working = busy || isWorking

  const controllerValue = useMemo<DealRepaymentControllerValue>(
    () => ({
      state: repaymentState,
      working,
      runExclusive,
      refreshAfterCommand,
      escrow,
    }),
    [escrow, refreshAfterCommand, repaymentState, runExclusive, working],
  )

  useEffect(() => {
    if (!deal.escrowAddress) return
    const syncKey = `${deal.id}:${deal.escrowAddress}`
    if (backgroundSyncedKeyRef.current === syncKey) return
    backgroundSyncedKeyRef.current = syncKey
    if (lockRef.current || isWorkingRef.current) return

    void syncDealFromIndexer(deal.id, deal.escrowAddress, undefined, {
      retryOnEmptyMilestones: false,
    })
      .then(() => {
        if (!lockRef.current && !isWorkingRef.current) {
          return refreshAfterCommand()
        }
        return undefined
      })
      .catch(() => {
        // Non-blocking; user can refresh manually
      })
  }, [deal.id, deal.escrowAddress, syncDealFromIndexer, refreshAfterCommand])

  if (deal.status === 'awaiting_funding') return null

  const handleRefreshStatus = async () => {
    if (!deal.escrowAddress) return
    await runExclusive(async () => {
      try {
        await syncDealFromIndexer(deal.id, deal.escrowAddress!, undefined, {
          retryOnEmptyMilestones: true,
        })
        await refreshAfterCommand()
        toast.success(t('dealDetail.repaymentRefreshSuccess'))
      } catch (err) {
        console.error(err)
        toast.error(
          err instanceof Error ? err.message : t('dealDetail.repaymentRefreshFail'),
        )
      }
    })
  }

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

  return (
    <DealRepaymentContext.Provider value={controllerValue}>
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
          {showEscrowProgress ? headerNotice : null}

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

          {actions}

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
    </DealRepaymentContext.Provider>
  )
}
