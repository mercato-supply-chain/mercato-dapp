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
import { Wallet, DollarSign, ExternalLink, RefreshCw, Scale } from 'lucide-react'
import type { ReleaseFallbackItem } from '@/lib/admin/types'
import {
  getMilestone,
  isMilestoneReleased,
  isMilestoneApproved,
  isMilestoneDisputed,
  canReleaseMilestoneInOrder,
} from '@/lib/admin/milestone-flags'
import { SupplierLogoInline } from '@/components/admin/supplier-logo-inline'
import { useI18n } from '@/lib/i18n/provider'
import {
  AdminResolveDisputeDialog,
  type ResolveDisputeTarget,
} from './admin-resolve-dispute-dialog'

interface ReleaseFundsFallbackProps {
  items: ReleaseFallbackItem[]
  /** When provided (from AdminEscrowsProvider), skip internal fetch to avoid duplicate API calls */
  escrowsByContractId?: Map<string, GetEscrowsFromIndexerResponse>
}

export function ReleaseFundsFallback({
  items,
  escrowsByContractId: escrowsFromParent,
}: ReleaseFundsFallbackProps) {
  const { t, locale } = useI18n()
  const numLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [resyncingId, setResyncingId] = useState<string | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<ResolveDisputeTarget | null>(
    null,
  )
  const [localEscrows, setLocalEscrows] = useState<
    Map<string, GetEscrowsFromIndexerResponse>
  >(new Map())
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const {
    approveRepaymentMilestone,
    releaseRepaymentMilestone,
    syncDealFromIndexer,
    isWorking,
  } = useRepaymentEscrow()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()

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

  const handleApproveOnly = async (item: ReleaseFallbackItem) => {
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
      toast.success(t('adminPending.approveSuccessShort', { title: item.milestoneTitle }))
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('adminPending.approveFail')
      console.error('Approve milestone error:', err)
      toast.error(message)
    } finally {
      setApprovingId(null)
    }
  }

  const handleReleaseOnly = async (item: ReleaseFallbackItem) => {
    if (!walletInfo?.address) {
      toast.error(t('adminPending.releaseConnect'))
      return
    }
    if (!item.escrowContractAddress) {
      toast.error(t('adminPending.noEscrow'))
      return
    }
    const escrow = escrowsByContractId.get(item.escrowContractAddress)
    if (!canReleaseMilestoneInOrder(escrow, item.milestoneIndex)) {
      toast.error(t('adminPending.releaseBlockedOrder'))
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

  const handleResync = async (item: ReleaseFallbackItem) => {
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

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminPending.fallbackEmpty')}</p>
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
        const onChainStatus = getMilestone(escrow, item.milestoneIndex)?.status ?? null
        const alreadyReleased = isMilestoneReleased(escrow, item.milestoneIndex)
        const alreadyApproved = isMilestoneApproved(escrow, item.milestoneIndex)
        const isDisputed = isMilestoneDisputed(escrow, item.milestoneIndex)
        const canReleaseInOrder = canReleaseMilestoneInOrder(escrow, item.milestoneIndex)
        return (
          <div
            key={item.milestoneId}
            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/deals/${item.dealId}`}
                  className="rounded font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {item.dealProductName || item.dealTitle || t('adminPage.fallbackDeal')}
                </Link>
                {isDisputed ? (
                  <Badge variant="destructive" className="text-xs">
                    {t('adminDispute.disputedBadge')}
                  </Badge>
                ) : null}
                {alreadyApproved && !alreadyReleased ? (
                  <Badge variant="secondary" className="bg-primary/10 text-xs text-primary">
                    {t('adminPending.approvedBadge')}
                  </Badge>
                ) : null}
                {alreadyReleased && (
                  <Badge variant="secondary" className="bg-success/10 text-xs text-success">
                    {t('adminPending.releasedBadge')}
                  </Badge>
                )}
                {onChainStatus && !alreadyReleased && (
                  <Badge variant="secondary" className="text-xs">
                    {t('adminPending.onChainStatus', { status: onChainStatus })}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.milestoneTitle} — $
                {item.milestoneAmount.toLocaleString(numLocale, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{' '}
                ({item.milestonePercentage}%)
              </p>
              <SupplierLogoInline
                logoUrl={item.supplierLogoUrl}
                alt={t('adminPending.supplierLogoAlt')}
                label={t('adminPending.supplierLogoLabel')}
                boxClassName="bg-background shadow-sm"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isConnected ? (
                <Button type="button" onClick={handleConnect} size="sm">
                  <Wallet className="mr-2 h-4 w-4" aria-hidden />
                  {t('adminPending.connectWalletShort')}
                </Button>
              ) : (
                <>
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
                      isWorking
                    }
                  >
                    {approvingId === item.milestoneId
                      ? t('adminPending.approvingShort')
                      : alreadyApproved
                        ? t('adminPending.approvedBadge')
                        : t('adminPending.approveBtn')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleReleaseOnly(item)}
                    disabled={
                      releasingId === item.milestoneId ||
                      alreadyReleased ||
                      isDisputed ||
                      !canReleaseInOrder ||
                      isWorking
                    }
                    title={
                      !canReleaseInOrder
                        ? t('adminPending.releasePreviousTooltip')
                        : undefined
                    }
                  >
                    <DollarSign className="mr-2 h-4 w-4" aria-hidden />
                    {releasingId === item.milestoneId
                      ? t('adminPending.releasingBtn')
                      : alreadyReleased
                        ? t('adminPending.releasedState')
                        : t('adminPending.releaseShort')}
                  </Button>
                </>
              )}
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
                {t('adminPending.resyncBtn')}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/deals/${item.dealId}`}>
                  {t('adminPending.viewDeal')}{' '}
                  <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
