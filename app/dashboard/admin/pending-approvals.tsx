'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Wallet,
  CheckCircle2,
  ExternalLink,
  Building2,
  User,
  DollarSign,
  FileText,
  Plus,
  RefreshCw,
  Scale,
} from 'lucide-react'
import type { PendingApprovalItem } from '@/lib/admin/types'
import {
  getMilestone,
  isMilestoneReleased,
  isMilestoneApproved,
  isMilestoneDisputed,
  canReleaseMilestoneInOrder,
} from '@/lib/admin/milestone-flags'
import { SupplierLogoInline } from '@/components/admin/supplier-logo-inline'
import { useI18n } from '@/lib/i18n/provider'
import { formatCurrency } from '@/lib/format'
import {
  AdminResolveDisputeDialog,
  type ResolveDisputeTarget,
} from './admin-resolve-dispute-dialog'
import {
  MERCATO_PLATFORM_ADDRESS,
  MERCATO_DISPUTE_RESOLVER_ADDRESS,
} from '@/lib/trustless/config'

interface PendingApprovalsProps {
  items: PendingApprovalItem[]
  /** When provided (from AdminEscrowsProvider), skip internal fetch to avoid duplicate API calls */
  escrowsByContractId?: Map<string, GetEscrowsFromIndexerResponse>
}

export function PendingApprovals({
  items,
  escrowsByContractId: escrowsFromParent,
}: PendingApprovalsProps) {
  const { t, locale } = useI18n()
  const numLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [resyncingId, setResyncingId] = useState<string | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<ResolveDisputeTarget | null>(
    null,
  )
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({})
  const [localEscrows, setLocalEscrows] = useState<
    Map<string, GetEscrowsFromIndexerResponse>
  >(new Map())
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const {
    approveRepaymentMilestone,
    releaseRepaymentMilestone,
    addRepaymentMilestone,
    startRepaymentDispute,
    syncDealFromIndexer,
    isWorking,
  } = useRepaymentEscrow()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const [disputingId, setDisputingId] = useState<string | null>(null)

  const escrowsByContractId = escrowsFromParent ?? localEscrows

  const contractIds = useMemo(
    () => [...new Set(items.map((i) => i.escrowContractAddress).filter(Boolean))],
    [items],
  )
  const contractIdsKey = useMemo(
    () => (contractIds.length ? contractIds.slice().sort().join(',') : ''),
    [contractIds],
  )
  const getEscrowRef = useRef(getEscrowByContractIds)
  getEscrowRef.current = getEscrowByContractIds

  useEffect(() => {
    if (escrowsFromParent !== undefined) return
    if (!contractIdsKey) {
      setLocalEscrows(new Map())
      return
    }
    let cancelled = false
    const ids = contractIdsKey.split(',').filter(Boolean)
    getEscrowRef
      .current({ contractIds: ids })
      .then((escrows) => {
        if (cancelled || !escrows) return
        const map = new Map<string, GetEscrowsFromIndexerResponse>()
        for (const e of escrows) {
          if (e.contractId) map.set(e.contractId, e)
        }
        setLocalEscrows(map)
      })
      .catch(() => setLocalEscrows(new Map()))
    return () => {
      cancelled = true
    }
  }, [contractIdsKey, escrowsFromParent])

  const handleApproveOnly = async (item: PendingApprovalItem) => {
    if (!walletInfo?.address) {
      toast.error(t('adminPending.connectWallet'))
      return
    }
    if (!item.escrowContractAddress) {
      toast.error(t('adminPending.noEscrow'))
      return
    }
    setApprovingId(item.milestoneId)
    try {
      await approveRepaymentMilestone({
        dealId: item.dealId,
        contractId: item.escrowContractAddress,
        releaseSigner: walletInfo.address,
        milestoneIndex: item.milestoneIndex,
        provider,
      })
      toast.success(t('adminPending.approveSuccess', { title: item.milestoneTitle }))
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('adminPending.approveFail')
      console.error('Approve milestone error:', err)
      toast.error(message)
    } finally {
      setApprovingId(null)
    }
  }

  const handleReleaseOnly = async (item: PendingApprovalItem) => {
    if (!walletInfo?.address) {
      toast.error(t('adminPending.releaseConnect'))
      return
    }
    if (!item.escrowContractAddress) {
      toast.error(t('adminPending.noEscrow'))
      return
    }
    setReleasingId(item.milestoneId)
    try {
      await releaseRepaymentMilestone({
        dealId: item.dealId,
        contractId: item.escrowContractAddress,
        releaseSigner: walletInfo.address,
        milestoneIndex: item.milestoneIndex,
        provider,
      })
      toast.success(t('adminPending.releaseSuccess', { title: item.milestoneTitle }))
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('adminPending.releaseFail')
      console.error('Release funds error:', err)
      toast.error(message)
    } finally {
      setReleasingId(null)
    }
  }

  const handleResync = async (item: PendingApprovalItem) => {
    if (!item.escrowContractAddress) return
    setResyncingId(item.dealId)
    try {
      await syncDealFromIndexer(item.dealId, item.escrowContractAddress)
      toast.success(t('adminPending.resyncSuccess'))
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('adminPending.resyncFail'),
      )
    } finally {
      setResyncingId(null)
    }
  }

  const handleStartDispute = async (item: PendingApprovalItem) => {
    if (!walletInfo?.address) {
      toast.error(t('adminPending.connectWallet'))
      return
    }
    if (
      MERCATO_PLATFORM_ADDRESS &&
      walletInfo.address !== MERCATO_PLATFORM_ADDRESS
    ) {
      toast.error(t('adminCreateEscrow.platformWalletRequired'))
      return
    }
    if (
      MERCATO_DISPUTE_RESOLVER_ADDRESS &&
      walletInfo.address === MERCATO_DISPUTE_RESOLVER_ADDRESS
    ) {
      toast.error(t('adminDispute.cannotOpenAsResolver'))
      return
    }
    if (!item.escrowContractAddress) {
      toast.error(t('adminPending.noEscrow'))
      return
    }
    setDisputingId(item.milestoneId)
    try {
      await startRepaymentDispute({
        dealId: item.dealId,
        contractId: item.escrowContractAddress,
        signer: walletInfo.address,
        milestoneIndex: item.milestoneIndex,
        provider,
      })
      toast.success(
        t('adminDispute.startSuccess', { title: item.milestoneTitle }),
      )
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('adminDispute.startFail'),
      )
    } finally {
      setDisputingId(null)
    }
  }

  const handleAddMilestone = async (item: PendingApprovalItem) => {
    if (!walletInfo?.address || !item.escrowContractAddress) return
    if (!item.investorAddress) {
      toast.error(t('adminCreateEscrow.investorMissing'))
      return
    }
    const remaining = item.remainingToSchedule ?? 0
    const parsed = Number.parseFloat(
      addAmounts[item.dealId] ?? String(remaining > 0 ? remaining : item.milestoneAmount),
    )
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('dealDetail.repaymentAddAmountInvalid'))
      return
    }
    setAddingId(item.dealId)
    try {
      await addRepaymentMilestone({
        dealId: item.dealId,
        contractId: item.escrowContractAddress,
        adminAddress: walletInfo.address,
        investorAddress: item.investorAddress,
        amount: parsed,
        provider,
      })
      toast.success(t('dealDetail.repaymentMilestoneAdded'))
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.repaymentAddMilestoneFail'),
      )
    } finally {
      setAddingId(null)
    }
  }

  const canPlatformOpenDispute =
    Boolean(MERCATO_PLATFORM_ADDRESS) &&
    Boolean(MERCATO_DISPUTE_RESOLVER_ADDRESS) &&
    MERCATO_PLATFORM_ADDRESS !== MERCATO_DISPUTE_RESOLVER_ADDRESS

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminPending.emptyPendingList')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <AdminResolveDisputeDialog
        target={disputeTarget}
        open={disputeTarget != null}
        onOpenChange={(next) => {
          if (!next) setDisputeTarget(null)
        }}
      />
      {items.map((item) => {
        const escrow = escrowsByContractId.get(item.escrowContractAddress)
        const alreadyReleased = isMilestoneReleased(escrow, item.milestoneIndex)
        const alreadyApproved = isMilestoneApproved(escrow, item.milestoneIndex)
        const isDisputed = isMilestoneDisputed(escrow, item.milestoneIndex)
        const canReleaseInOrder = canReleaseMilestoneInOrder(
          escrow,
          item.milestoneIndex,
        )
        const balance = Number(escrow?.balance ?? 0)
        const onChainStatus = getMilestone(escrow, item.milestoneIndex)?.status ?? null
        const showAdd =
          (item.remainingToSchedule ?? 0) > 0.01 &&
          (item.repaymentStatus === 'partially_released' ||
            alreadyReleased ||
            item.repaymentStatus === 'ready_to_release')
        const isReleaseReady =
          item.repaymentStatus === 'ready_to_release' ||
          item.repaymentStatus === 'funded'

        return (
          <div
            key={item.milestoneId}
            className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/deals/${item.dealId}`}
                    className="rounded font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {item.dealProductName ||
                      item.dealTitle ||
                      t('adminPage.fallbackDeal')}
                  </Link>
                  <Badge variant="secondary">{item.milestoneTitle}</Badge>
                  {isDisputed ? (
                    <Badge variant="destructive">{t('adminDispute.disputedBadge')}</Badge>
                  ) : null}
                  {isReleaseReady && !alreadyReleased && !isDisputed ? (
                    <Badge className="bg-orange-500/15 text-orange-900 dark:text-orange-200">
                      {t('adminPending.readyBadge')}
                    </Badge>
                  ) : null}
                  {alreadyApproved && !alreadyReleased ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {t('adminPending.approvedBadge')}
                    </Badge>
                  ) : null}
                  {alreadyReleased && (
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      {t('adminPending.releasedBadge')}
                    </Badge>
                  )}
                  {onChainStatus && !alreadyReleased ? (
                    <Badge variant="outline" className="text-xs">
                      {t('adminPending.onChainStatus', { status: onChainStatus })}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {t('adminPending.releaseAmountLine', {
                        amount: `$${item.milestoneAmount.toLocaleString(numLocale, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}`,
                        percent: item.milestonePercentage,
                      })}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2 text-muted-foreground"
                    title="PyME (Buyer)"
                  >
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.pymeName}</span>
                  </div>
                  <div
                    className="flex items-center gap-2 text-muted-foreground"
                    title="Supplier"
                  >
                    <SupplierLogoInline
                      logoUrl={item.supplierLogoUrl}
                      alt={item.supplierName}
                      fallbackIcon={User}
                      boxClassName="bg-muted/30"
                    />
                    <span className="truncate">{item.supplierName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {t('adminPending.dealTotalLine', {
                      amount: `$${item.dealAmount.toLocaleString(numLocale)}`,
                    })}
                  </div>
                </div>

                {escrow ? (
                  <p className="text-xs text-muted-foreground">
                    {t('adminPending.escrowBalanceLine', {
                      amount: formatCurrency(balance),
                    })}
                    {item.escrowContractAddress ? (
                      <>
                        {' · '}
                        <span className="font-mono">
                          {item.escrowContractAddress.slice(0, 4)}…
                          {item.escrowContractAddress.slice(-4)}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : item.escrowContractAddress ? (
                  <p className="text-xs text-muted-foreground">
                    {t('adminPending.indexerPending')}
                  </p>
                ) : null}

                {(item.proofNotes || item.proofDocumentUrl) && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2 text-sm">
                      <FileText
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        {item.proofNotes && (
                          <p className="text-muted-foreground">{item.proofNotes}</p>
                        )}
                        {item.proofDocumentUrl && (
                          <a
                            href={item.proofDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            {t('adminPending.viewDocument')}{' '}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {showAdd ? (
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-2">
                    <div className="min-w-[8rem] flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {t('adminPending.addMilestoneHint', {
                          amount: formatCurrency(item.remainingToSchedule ?? 0),
                        })}
                      </p>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder={String(item.remainingToSchedule ?? '')}
                        value={addAmounts[item.dealId] ?? ''}
                        onChange={(e) =>
                          setAddAmounts((prev) => ({
                            ...prev,
                            [item.dealId]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        addingId === item.dealId || isWorking || !isConnected
                      }
                      onClick={() => handleAddMilestone(item)}
                    >
                      <Plus className="mr-1 h-4 w-4" aria-hidden />
                      {addingId === item.dealId
                        ? t('dealDetail.repaymentAddingMilestone')
                        : t('adminPending.addMilestoneBtn')}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {!isConnected ? (
                  <Button type="button" onClick={handleConnect} size="sm">
                    <Wallet className="mr-2 h-4 w-4" aria-hidden />
                    {t('adminPending.connectWalletShort')}
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {isDisputed ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={alreadyReleased || isWorking}
                        onClick={() =>
                          setDisputeTarget({
                            dealId: item.dealId,
                            escrowContractAddress: item.escrowContractAddress,
                            milestoneId: item.milestoneId,
                            milestoneTitle: item.milestoneTitle,
                            milestoneIndex: item.milestoneIndex,
                            milestoneAmount: item.milestoneAmount,
                            investorAddress: item.investorAddress ?? null,
                            pymeAddress: item.pymeAddress ?? null,
                          })
                        }
                      >
                        <Scale className="mr-2 h-4 w-4" aria-hidden />
                        {t('adminDispute.resolveCta')}
                      </Button>
                    ) : canPlatformOpenDispute ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          disputingId === item.milestoneId ||
                          alreadyReleased ||
                          isWorking
                        }
                        onClick={() => handleStartDispute(item)}
                        title={t('adminDispute.startTooltip')}
                      >
                        <Scale className="mr-2 h-4 w-4" aria-hidden />
                        {disputingId === item.milestoneId
                          ? t('adminDispute.starting')
                          : t('adminDispute.startCta')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproveOnly(item)}
                      disabled={
                        approvingId === item.milestoneId ||
                        alreadyReleased ||
                        alreadyApproved ||
                        isDisputed ||
                        !canReleaseInOrder ||
                        isWorking
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" aria-hidden />
                      {approvingId === item.milestoneId
                        ? t('adminPending.approvingShort')
                        : alreadyApproved
                          ? t('adminPending.approvedBadge')
                          : t('adminPending.approveBtn')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleReleaseOnly(item)}
                      disabled={
                        releasingId === item.milestoneId ||
                        alreadyReleased ||
                        isDisputed ||
                        !canReleaseInOrder ||
                        isWorking
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                      {releasingId === item.milestoneId
                        ? t('adminPending.releasingBtn')
                        : alreadyReleased
                          ? t('adminPending.releasedState')
                          : t('adminPending.releaseShort')}
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={resyncingId === item.dealId || isWorking}
                    onClick={() => handleResync(item)}
                  >
                    <RefreshCw
                      className={`mr-1 h-3.5 w-3.5 ${
                        resyncingId === item.dealId ? 'animate-spin' : ''
                      }`}
                      aria-hidden
                    />
                    {resyncingId === item.dealId
                      ? t('adminPending.resyncing')
                      : t('adminPending.resyncBtn')}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/deals/${item.dealId}`}>
                      {t('adminPending.viewDeal')}{' '}
                      <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
