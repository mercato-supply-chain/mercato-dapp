'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useApproveMilestone, useReleaseFunds, useSendTransaction, useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { ApproveMilestonePayload, SingleReleaseReleaseFundsPayload } from '@trustless-work/escrow'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Wallet, CheckCircle2, ExternalLink, Building2, User, DollarSign, FileText } from 'lucide-react'
import type { PendingApprovalItem } from '@/lib/admin/types'
import { useI18n } from '@/lib/i18n/provider'

interface PendingApprovalsProps {
  items: PendingApprovalItem[]
  /** When provided (from AdminEscrowsProvider), skip internal fetch to avoid duplicate API calls */
  escrowsByContractId?: Map<string, GetEscrowsFromIndexerResponse>
}

function SupplierLogoPending({
  logoUrl,
  companyName,
  fallbackIcon: Icon = User
}: {
  logoUrl: string | null
  companyName: string
  fallbackIcon?: any
}) {
  const [imageError, setImageError] = useState(false)
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/30">
      {logoUrl && !imageError ? (
        <img
          src={logoUrl}
          alt={companyName}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Icon className="h-3 w-3" aria-hidden />
      )}
    </div>
  )
}

function isMilestoneReleased(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number
): boolean {
  const m = escrow?.milestones?.[milestoneIndex] as { status?: string; released?: boolean } | undefined
  if (!m) return false
  if (m.released === true) return true
  const s = (m.status ?? '').toLowerCase()
  return s === 'released' || s === 'completed'
}

/** Release only allowed if all previous milestones are released (order: 0 → 1 → 2 …) */
function canReleaseMilestoneInOrder(
  escrow: GetEscrowsFromIndexerResponse | undefined,
  milestoneIndex: number
): boolean {
  if (milestoneIndex === 0) return true
  for (let i = 0; i < milestoneIndex; i++) {
    if (!isMilestoneReleased(escrow, i)) return false
  }
  return true
}

export function PendingApprovals({ items, escrowsByContractId: escrowsFromParent }: PendingApprovalsProps) {
  const { t, locale } = useI18n()
  const numLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [localEscrows, setLocalEscrows] = useState<Map<string, GetEscrowsFromIndexerResponse>>(new Map())
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { sendTransaction } = useSendTransaction()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const supabase = createClient()

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
      const approvePayload: ApproveMilestonePayload = {
        contractId: item.escrowContractAddress,
        milestoneIndex: String(item.milestoneIndex),
        approver: walletInfo.address,
      }
      const approveResponse = await approveMilestone(approvePayload, 'single-release')
      if (approveResponse.status !== 'SUCCESS' || !approveResponse.unsignedTransaction) {
        throw new Error(t('adminPending.approveFailCreate'))
      }
      const approveSigned = await signTransaction({
        unsignedTransaction: approveResponse.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!approveSigned) throw new Error(t('adminPending.signApproveFail'))
      const approveTx = await sendTransaction(approveSigned)
      if (approveTx.status !== 'SUCCESS') {
        throw new Error(
          'message' in approveTx ? (approveTx as { message: string }).message : t('adminPending.approveTxFail')
        )
      }
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
      const releasePayload: SingleReleaseReleaseFundsPayload = {
        contractId: item.escrowContractAddress,
        releaseSigner: walletInfo.address,
      }
      const releaseResponse = await releaseFunds(releasePayload, 'single-release')
      if (releaseResponse.status !== 'SUCCESS' || !releaseResponse.unsignedTransaction) {
        throw new Error(t('adminPending.releaseFailCreate'))
      }
      const releaseSigned = await signTransaction({
        unsignedTransaction: releaseResponse.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!releaseSigned) throw new Error(t('adminPending.releaseSignFail'))
      const releaseTx = await sendTransaction(releaseSigned)
      if (releaseTx.status !== 'SUCCESS') {
        throw new Error(
          'message' in releaseTx ? (releaseTx as { message: string }).message : t('adminPending.releaseTxFail')
        )
      }
      const { error } = await supabase
        .from('deals')
        .update({
          repayment_status: 'released',
          escrow_status: 'completed',
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.dealId)
      if (error) throw error
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

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminPending.emptyPendingList')}</p>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const escrow = escrowsByContractId.get(item.escrowContractAddress)
        const alreadyReleased = isMilestoneReleased(escrow, item.milestoneIndex)
        const canReleaseInOrder = canReleaseMilestoneInOrder(escrow, item.milestoneIndex)
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
                  className="font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                >
                  {item.dealProductName || item.dealTitle || t('adminPage.fallbackDeal')}
                </Link>
                <Badge variant="secondary">{item.milestoneTitle}</Badge>
                {alreadyReleased && (
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    {t('adminPending.releasedBadge')}
                  </Badge>
                )}
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {t('adminPending.releaseAmountLine', {
                      amount: `$${item.milestoneAmount.toLocaleString(numLocale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      percent: item.milestonePercentage,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground" title="PyME (Buyer)">
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.pymeName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground" title="Supplier">
                  <SupplierLogoPending
                    logoUrl={item.supplierLogoUrl}
                    companyName={item.supplierName}
                  />
                  <span className="truncate">{item.supplierName}</span>
                </div>
                <div className="text-muted-foreground">
                  {t('adminPending.dealTotalLine', {
                    amount: `$${item.dealAmount.toLocaleString(numLocale)}`,
                  })}
                </div>
              </div>

              {(item.proofNotes || item.proofDocumentUrl) && (
                <>
                  <Separator />
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      {item.proofNotes && <p className="text-muted-foreground">{item.proofNotes}</p>}
                      {item.proofDocumentUrl && (
                        <a
                          href={item.proofDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline mt-1"
                        >
                          {t('adminPending.viewDocument')} <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {!isConnected ? (
                <Button type="button" onClick={handleConnect} size="sm">
                  <Wallet className="mr-2 h-4 w-4" aria-hidden />
                  {t('adminPending.connectWalletShort')}
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproveOnly(item)}
                    disabled={approvingId === item.milestoneId || alreadyReleased}
                  >
                    <FileText className="mr-2 h-4 w-4" aria-hidden />
                    {approvingId === item.milestoneId ? t('adminPending.approvingShort') : t('adminPending.approveBtn')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleReleaseOnly(item)}
                    disabled={releasingId === item.milestoneId || alreadyReleased}
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
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/deals/${item.dealId}`}>
                  {t('adminPending.viewDeal')} <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}
