'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useApproveMilestone, useReleaseFunds, useSendTransaction, useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { ApproveMilestonePayload, MultiReleaseReleaseFundsPayload } from '@trustless-work/escrow'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, DollarSign, ExternalLink } from 'lucide-react'
import type { ReleaseFallbackItem } from './page'

interface ReleaseFundsFallbackProps {
  items: ReleaseFallbackItem[]
  /** When provided (from AdminEscrowsProvider), skip internal fetch to avoid duplicate API calls */
  escrowsByContractId?: Map<string, GetEscrowsFromIndexerResponse>
}

export function ReleaseFundsFallback({ items, escrowsByContractId: escrowsFromParent }: ReleaseFundsFallbackProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [localEscrows, setLocalEscrows] = useState<Map<string, GetEscrowsFromIndexerResponse>>(new Map())
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { sendTransaction } = useSendTransaction()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { walletInfo, isConnected, handleConnect } = useWallet()

  const escrowsByContractId = escrowsFromParent ?? localEscrows

  const contractIds = useMemo(() => [...new Set(items.map((i) => i.escrowContractAddress).filter(Boolean))], [items])
  const contractIdsKey = useMemo(() => (contractIds.length ? contractIds.slice().sort().join(',') : ''), [contractIds])
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
    getEscrowRef.current({ contractIds: ids })
      .then((escrows) => {
        if (cancelled || !escrows) return
        const map = new Map<string, GetEscrowsFromIndexerResponse>()
        for (const e of escrows) {
          if (e.contractId) map.set(e.contractId, e)
        }
        setLocalEscrows(map)
      })
      .catch(() => setLocalEscrows(new Map()))
    return () => { cancelled = true }
  }, [contractIdsKey, escrowsFromParent])

  const handleApproveOnly = async (item: ReleaseFallbackItem) => {
    if (!walletInfo?.address) {
      toast.error('Connect your Stellar wallet to approve.')
      return
    }
    if (!item.escrowContractAddress) {
      toast.error('Deal has no escrow contract.')
      return
    }
    setApprovingId(item.milestoneId)
    try {
      const approvePayload: ApproveMilestonePayload = {
        contractId: item.escrowContractAddress,
        milestoneIndex: String(item.milestoneIndex),
        approver: walletInfo.address,
      }
      const approveResponse = await approveMilestone(approvePayload, 'multi-release')
      if (approveResponse.status !== 'SUCCESS' || !approveResponse.unsignedTransaction) {
        throw new Error('Failed to create approval transaction')
      }
      const approveSigned = await signTransaction({
        unsignedTransaction: approveResponse.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!approveSigned) throw new Error('Failed to sign approval transaction')
      const approveTx = await sendTransaction(approveSigned)
      if (approveTx.status !== 'SUCCESS') {
        throw new Error(
          'message' in approveTx ? (approveTx as { message: string }).message : 'Approval failed'
        )
      }
      toast.success(`Milestone "${item.milestoneTitle}" approved on-chain.`)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed'
      console.error('Approve milestone error:', err)
      toast.error(message)
    } finally {
      setApprovingId(null)
    }
  }

  const handleReleaseOnly = async (item: ReleaseFallbackItem) => {
    if (!walletInfo?.address) {
      toast.error('Connect your Stellar wallet to release funds.')
      return
    }
    if (!item.escrowContractAddress) {
      toast.error('Deal has no escrow contract.')
      return
    }
    const escrow = escrowsByContractId.get(item.escrowContractAddress)
    if (!canReleaseMilestoneInOrder(escrow, item.milestoneIndex)) {
      toast.error('Release the previous milestone first (Shipment → Delivery).')
      return
    }
    setReleasingId(item.milestoneId)
    try {
      const releasePayload: MultiReleaseReleaseFundsPayload = {
        contractId: item.escrowContractAddress,
        releaseSigner: walletInfo.address,
        milestoneIndex: String(item.milestoneIndex),
      }
      const releaseResponse = await releaseFunds(releasePayload, 'multi-release')
      if (releaseResponse.status !== 'SUCCESS' || !releaseResponse.unsignedTransaction) {
        throw new Error('Failed to create release transaction')
      }
      const releaseSigned = await signTransaction({
        unsignedTransaction: releaseResponse.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!releaseSigned) throw new Error('Failed to sign release transaction')
      const releaseTx = await sendTransaction(releaseSigned)
      if (releaseTx.status !== 'SUCCESS') {
        throw new Error(
          'message' in releaseTx ? (releaseTx as { message: string }).message : 'Release transaction failed'
        )
      }
      toast.success(`Funds released for "${item.milestoneTitle}".`)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Release failed'
      console.error('Release funds error:', err)
      toast.error(message)
    } finally {
      setReleasingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed milestones. Completed milestones will appear here so you can trigger release if needed.
      </p>
    )
  }

  const isMilestoneReleased = (
    escrow: GetEscrowsFromIndexerResponse | undefined,
    milestoneIndex: number
  ): boolean => {
    const m = escrow?.milestones?.[milestoneIndex] as { status?: string; released?: boolean } | undefined
    if (!m) return false
    if (m.released === true) return true
    const s = (m.status ?? '').toLowerCase()
    return s === 'released' || s === 'completed'
  }

  /** Release only allowed if all previous milestones are released (order: 0 → 1 → 2 …) */
  const canReleaseMilestoneInOrder = (
    escrow: GetEscrowsFromIndexerResponse | undefined,
    milestoneIndex: number
  ): boolean => {
    if (milestoneIndex === 0) return true
    for (let i = 0; i < milestoneIndex; i++) {
      if (!isMilestoneReleased(escrow, i)) return false
    }
    return true
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const escrow = escrowsByContractId.get(item.escrowContractAddress)
        const indexerMilestone = escrow?.milestones?.[item.milestoneIndex] as { status?: string } | undefined
        const onChainStatus = indexerMilestone?.status ?? null
        const alreadyReleased = isMilestoneReleased(escrow, item.milestoneIndex)
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
                className="font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {item.dealProductName || item.dealTitle}
              </Link>
              {alreadyReleased && (
                <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                  Released
                </Badge>
              )}
              {onChainStatus && !alreadyReleased && (
                <Badge variant="secondary" className="text-xs">
                  On-chain: {onChainStatus}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.milestoneTitle} — ${item.milestoneAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({item.milestonePercentage}%)
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isConnected ? (
              <Button type="button" onClick={handleConnect} size="sm">
                <Wallet className="mr-2 h-4 w-4" aria-hidden />
                Connect wallet
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleApproveOnly(item)}
                  disabled={approvingId === item.milestoneId || alreadyReleased}
                >
                  {approvingId === item.milestoneId ? 'Approving…' : 'Approve'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleReleaseOnly(item)}
                  disabled={releasingId === item.milestoneId || alreadyReleased || !canReleaseInOrder}
                  title={!canReleaseInOrder ? 'Release the previous milestone first (Shipment → Delivery)' : undefined}
                >
                  <DollarSign className="mr-2 h-4 w-4" aria-hidden />
                  {releasingId === item.milestoneId ? 'Releasing…' : alreadyReleased ? 'Released' : 'Release'}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/deals/${item.dealId}`}>
                View deal <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
        )
      })}
    </div>
  )
}
