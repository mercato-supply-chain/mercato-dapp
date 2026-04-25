'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFundingTimeRemainingMs, mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal } from '@/lib/types'
import { useFundEscrow, useSendTransaction, useChangeMilestoneStatus, useApproveMilestone, useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { FundEscrowPayload, ChangeMilestoneStatusPayload, ApproveMilestonePayload } from '@trustless-work/escrow'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/date-utils'
import { formatCurrency } from '@/lib/format'
import {
  Package,
  Building2,
  Calendar,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowLeft,
} from 'lucide-react'

/** Match "Shipment Confirmation" milestone (supplier accepts order) */
function isShipmentMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('shipment')) return true
  if (n.includes('delivery')) return false
  return total === 2 && index === 0
}

/** Match "Delivery Confirmation" milestone (PyME confirms receipt) */
function isDeliveryMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('delivery')) return true
  if (n.includes('shipment')) return false
  return total === 2 && index === 1
}

function formatFundingRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / (60 * 1000))
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m left`
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h left`
  const totalDays = Math.floor(totalHours / 24)
  return `${totalDays}d left`
}

export default function DealDetailPage() {
  const params = useParams()
  const dealId = typeof params.id === 'string' ? params.id : params.id?.[0]
  const [deal, setDeal] = useState<Deal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFundingDialogOpen, setIsFundingDialogOpen] = useState(false)
  const [isFunding, setIsFunding] = useState(false)
  const [isSupplierView, setIsSupplierView] = useState(false)
  const [userType, setUserType] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [proofDialogOpen, setProofDialogOpen] = useState(false)
  const [proofMilestoneIndex, setProofMilestoneIndex] = useState<number | null>(null)
  const [proofMilestoneId, setProofMilestoneId] = useState<string | null>(null)
  const [proofNotes, setProofNotes] = useState('')
  const [proofDocumentUrl, setProofDocumentUrl] = useState('')
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [acceptingMilestoneId, setAcceptingMilestoneId] = useState<string | null>(null)
  const [confirmingDeliveryMilestoneId, setConfirmingDeliveryMilestoneId] = useState<string | null>(null)
  const [indexerEscrow, setIndexerEscrow] = useState<GetEscrowsFromIndexerResponse | null>(null)
  const [extendFundingDialogOpen, setExtendFundingDialogOpen] = useState(false)
  const [extendFundingDays, setExtendFundingDays] = useState('7')
  const [isExtendingFundingWindow, setIsExtendingFundingWindow] = useState(false)

  const { fundEscrow } = useFundEscrow()
  const { sendTransaction } = useSendTransaction()
  const { changeMilestoneStatus } = useChangeMilestoneStatus()
  const { approveMilestone } = useApproveMilestone()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const hasHandledAction = useRef(false)

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserType(null)
        setUserId(null)
        return
      }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()
      setUserType(profile?.user_type ?? null)
    }
    loadUserProfile()
  }, [supabase])

  const isSupplier = Boolean(deal?.supplierOwnerId && userId && deal.supplierOwnerId === userId)
  const isPyme = Boolean(deal?.pymeId && userId && deal.pymeId === userId)
  const isAdmin = userType === 'admin'

  const fetchDeal = useCallback(async () => {
    if (!dealId) return null
    const { data, error } = await supabase
      .from('deals')
      .select(
        `
        *,
        milestones(*),
        pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
        investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name),
        supplier:supplier_companies(company_name, full_name, contact_name, owner_id, address)
      `
      )
      .eq('id', dealId)
      .single()
    if (error || !data) return null
    return mapDealFromDb(data as DealRow)
  }, [dealId, supabase])

  useEffect(() => {
    if (!dealId) {
      setIsLoading(false)
      return
    }
    fetchDeal().then((d) => {
      setDeal(d)
      setIsLoading(false)
    })
  }, [dealId, fetchDeal])

  // Fetch on-chain escrow state from indexer when deal has escrow
  const escrowAddress = deal?.escrowAddress ?? ''
  const getEscrowRef = useRef(getEscrowByContractIds)
  getEscrowRef.current = getEscrowByContractIds
  useEffect(() => {
    if (!escrowAddress) {
      setIndexerEscrow(null)
      return
    }
    let cancelled = false
    getEscrowRef.current({ contractIds: [escrowAddress] })
      .then((escrows) => {
        if (!cancelled && escrows?.length) setIndexerEscrow(escrows[0])
        else if (!cancelled) setIndexerEscrow(null)
      })
      .catch(() => {
        if (!cancelled) setIndexerEscrow(null)
      })
    return () => { cancelled = true }
  }, [escrowAddress])

  // Open confirm-delivery dialog when arriving with ?action=delivery (Delivery Confirmation milestone)
  useEffect(() => {
    if (!deal || isLoading || !userId || hasHandledAction.current) return
    const pymeMatch = deal.pymeId && deal.pymeId === userId
    if (!pymeMatch) return
    const action = searchParams.get('action')
    if (action !== 'delivery') return
    const deliveryMilestone = deal.milestones.find((m) =>
      (m.name || '').toLowerCase().includes('delivery')
    )
    if (!deliveryMilestone || deliveryMilestone.status !== 'pending') return
    const milestoneIndex = deal.milestones.findIndex((m) => m.id === deliveryMilestone.id)
    hasHandledAction.current = true
    setProofMilestoneIndex(milestoneIndex >= 0 ? milestoneIndex : 1)
    setProofMilestoneId(deliveryMilestone.id)
    setProofNotes('')
    setProofDocumentUrl('')
    setProofDialogOpen(true)
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [deal, isLoading, userId, searchParams])

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-10">
          <div className="mb-8 h-4 w-36 animate-pulse rounded-full bg-muted" />
          <div className="mb-3 flex gap-2">
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mb-2 h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="mb-8 h-5 w-1/2 animate-pulse rounded-lg bg-muted" />
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="h-72 animate-pulse rounded-2xl bg-muted" />
              <div className="h-48 animate-pulse rounded-2xl bg-muted" />
            </div>
            <div className="space-y-6">
              <div className="h-40 animate-pulse rounded-2xl bg-muted" />
              <div className="h-48 animate-pulse rounded-2xl bg-muted" />
              <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">Deal Not Found</h1>
            <p className="mb-4 text-muted-foreground">
              The deal you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button asChild>
              <Link href="/deals">Back to deals</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = {
    awaiting_funding: { label: 'Open for Funding', color: 'text-accent', bgColor: 'bg-accent/10' },
    funded: { label: 'Funded', color: 'text-success', bgColor: 'bg-success/10' },
    in_progress: { label: 'In Progress', color: 'text-warning', bgColor: 'bg-warning/10' },
    milestone_pending: { label: 'Milestone Pending', color: 'text-warning', bgColor: 'bg-warning/10' },
    completed: { label: 'Completed', color: 'text-success', bgColor: 'bg-success/10' },
    disputed: { label: 'Disputed', color: 'text-destructive', bgColor: 'bg-destructive/10' },
    released: { label: 'Released', color: 'text-success', bgColor: 'bg-success/10' },
  }

  const fundingStatusConfig = {
    open: { label: 'Open for Funding', color: 'text-accent', bgColor: 'bg-accent/10' },
    extended: { label: 'Extended', color: 'text-warning', bgColor: 'bg-warning/10' },
    expired: { label: 'Expired', color: 'text-destructive', bgColor: 'bg-destructive/10' },
    funded: { label: 'Funded', color: 'text-success', bgColor: 'bg-success/10' },
  }

  const status =
    deal.status === 'awaiting_funding'
      ? fundingStatusConfig[deal.fundingStatus]
      : statusConfig[deal.status]
  const isFundingOpen =
    deal.fundingStatus === 'open' || deal.fundingStatus === 'extended'
  const isFundingExpired = deal.fundingStatus === 'expired'
  const fundingRemainingMs = getFundingTimeRemainingMs(deal.fundingExpiresAt)
  const completedMilestones = deal.milestones.filter(m => m.status === 'completed').length
  const progressPercentage = (completedMilestones / deal.milestones.length) * 100

  const handleFundDeal = async () => {
    if (!deal || !walletInfo?.address || !deal.escrowAddress) return
    if (userType !== 'investor') {
      toast.error('Only investors can fund deals.')
      return
    }

    const investorAddress = walletInfo.address
    setIsFunding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be signed in to fund a deal.')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()
      if (profile?.user_type !== 'investor') {
        toast.error('Only investors can fund deals.')
        return
      }

      // Trustless fund-escrow API expects human-readable amount (e.g. 51 for $51 USDC), not stroops.
      const payload: FundEscrowPayload = {
        contractId: deal.escrowAddress,
        signer: investorAddress,
        amount: deal.priceUSDC,
      }

      const fundResponse = await fundEscrow(payload, 'multi-release')
      if (fundResponse.status !== 'SUCCESS' || !fundResponse.unsignedTransaction) {
        throw new Error('Failed to build fund transaction')
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: fundResponse.unsignedTransaction,
        address: investorAddress,
      })
      if (!signedXdr) throw new Error('Signed transaction is missing.')

      const txResult = await sendTransaction(signedXdr)
      if (txResult.status !== 'SUCCESS') {
        const msg = 'message' in txResult ? (txResult as { message: string }).message : 'Transaction failed'
        throw new Error(msg)
      }

      const { error: updateError } = await supabase
        .from('deals')
        .update({
          investor_id: user.id,
          status: 'funded',
          funded_at: new Date().toISOString(),
        })
        .eq('id', deal.id)

      if (updateError) throw updateError

      const updated = await fetchDeal()
      if (!updated || updated.status !== 'funded') {
        throw new Error(
          'Funding succeeded on-chain but the deal could not be updated. Please refresh the page or contact support.'
        )
      }
      setDeal(updated)
      toast.success('Deal funded successfully!')
      setIsFundingDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fund deal'
      console.error('Fund deal error:', err)
      toast.error(message)
    } finally {
      setIsFunding(false)
    }
  }

  const openProofDialog = (index: number, milestoneId: string) => {
    setProofMilestoneIndex(index)
    setProofMilestoneId(milestoneId)
    setProofNotes('')
    setProofDocumentUrl('')
    setProofDialogOpen(true)
  }

  const handleAcceptOrder = async (milestoneIndex: number, milestoneId: string) => {
    if (
      !deal?.escrowAddress ||
      !walletInfo?.address
    ) {
      toast.error('Missing deal or wallet. Connect your Stellar wallet.')
      return
    }
    if (!isConnected) {
      toast.error('Connect your Stellar wallet to accept the order.')
      return
    }
    setAcceptingMilestoneId(milestoneId)
    try {
      const payload: ChangeMilestoneStatusPayload = {
        contractId: deal.escrowAddress,
        milestoneIndex: String(milestoneIndex),
        newStatus: 'release_requested',
        newEvidence: 'Order accepted by supplier',
        serviceProvider: walletInfo.address,
      }
      const response = await changeMilestoneStatus(payload, 'multi-release')
      if (response.status !== 'SUCCESS' || !response.unsignedTransaction) {
        throw new Error('Failed to create milestone status transaction')
      }
      const signedXdr = await signTransaction({
        unsignedTransaction: response.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!signedXdr) throw new Error('Failed to sign transaction')
      const txResult = await sendTransaction(signedXdr)
      if (txResult.status !== 'SUCCESS') {
        throw new Error('message' in txResult ? (txResult as { message: string }).message : 'Transaction failed')
      }
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          status: 'in_progress',
          proof_notes: 'Order accepted by supplier',
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)
      if (updateError) throw updateError
      const updated = await fetchDeal()
      if (updated) setDeal(updated)
      toast.success('Order accepted. Admin will release the milestone to unlock 50%.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept order'
      console.error('Accept order error:', err)
      toast.error(message)
    } finally {
      setAcceptingMilestoneId(null)
    }
  }

  const handleConfirmDelivery = async () => {
    if (
      !deal?.escrowAddress ||
      proofMilestoneIndex == null ||
      !proofMilestoneId ||
      !walletInfo?.address
    ) {
      toast.error('Missing deal, milestone, or wallet. Connect your Stellar wallet.')
      return
    }
    if (!isConnected) {
      toast.error('Connect your Stellar wallet to confirm delivery.')
      return
    }
    if (!isPyme && !isAdmin) {
      toast.error('Only the PyME (buyer) or admin can confirm delivery.')
      return
    }
    const evidence = [proofNotes, proofDocumentUrl].filter(Boolean).join(' | ') || 'Delivery confirmed by PyME'
    setIsSubmittingProof(true)
    setConfirmingDeliveryMilestoneId(proofMilestoneId)
    try {
      const payload: ApproveMilestonePayload = {
        contractId: deal.escrowAddress,
        milestoneIndex: String(proofMilestoneIndex),
        approver: walletInfo.address,
      }
      const response = await approveMilestone(payload, 'multi-release')
      if (response.status !== 'SUCCESS' || !response.unsignedTransaction) {
        throw new Error('Failed to create approval transaction')
      }
      const signedXdr = await signTransaction({
        unsignedTransaction: response.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!signedXdr) throw new Error('Failed to sign transaction')
      const txResult = await sendTransaction(signedXdr)
      if (txResult.status !== 'SUCCESS') {
        throw new Error('message' in txResult ? (txResult as { message: string }).message : 'Transaction failed')
      }
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          status: 'in_progress',
          proof_notes: evidence || null,
          proof_document_url: proofDocumentUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proofMilestoneId)
      if (updateError) throw updateError
      const updated = await fetchDeal()
      if (updated) setDeal(updated)
      toast.success('Delivery confirmed. Admin will release the final 50% to the supplier.')
      setProofDialogOpen(false)
      setProofMilestoneIndex(null)
      setProofMilestoneId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm delivery'
      console.error('Confirm delivery error:', err)
      toast.error(message)
    } finally {
      setIsSubmittingProof(false)
      setConfirmingDeliveryMilestoneId(null)
    }
  }

  const handleExtendFundingWindow = async () => {
    if (!deal || !userId) return
    if (!isPyme) {
      toast.error('Only the PyME owner can extend the funding window.')
      return
    }
    if (deal.fundingStatus !== 'expired' || deal.status !== 'awaiting_funding') {
      toast.error('This deal is not eligible for extension.')
      return
    }

    const nextWindowDays = Number(extendFundingDays)
    if (!Number.isInteger(nextWindowDays) || nextWindowDays <= 0) {
      toast.error('Enter a valid extension duration in days.')
      return
    }

    setIsExtendingFundingWindow(true)
    try {
      const nowIso = new Date().toISOString()
      const nextExpirationIso = new Date(
        Date.now() + nextWindowDays * 24 * 60 * 60 * 1000
      ).toISOString()

      const { data, error } = await supabase
        .from('deals')
        .update({
          funding_window_days: nextWindowDays,
          funding_expires_at: nextExpirationIso,
          extension_count: (deal.extensionCount ?? 0) + 1,
          extended_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', deal.id)
        .eq('pyme_id', userId)
        .eq('status', 'seeking_funding')
        .is('investor_id', null)
        .select('id')
        .single()

      if (error) throw error
      if (!data) {
        throw new Error('Deal is no longer eligible for extension.')
      }

      const updated = await fetchDeal()
      if (updated) setDeal(updated)
      toast.success('Funding window extended successfully.')
      setExtendFundingDialogOpen(false)
      setExtendFundingDays(String(nextWindowDays))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to extend funding window'
      console.error('Extend funding window error:', err)
      toast.error(message)
    } finally {
      setIsExtendingFundingWindow(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/deals" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Deals
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
          <span className="truncate text-foreground/70">{deal.productName || 'Deal details'}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status.color} ${status.bgColor} ring-current/20`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${status.color.replace('text-', 'bg-')}`} aria-hidden />
                  {status.label}
                </span>
                {deal.category && (
                  <Badge variant="outline" className="capitalize">{deal.category}</Badge>
                )}
                {(deal.yieldBonusApr ?? 0) > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-success/10 text-success">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    +{deal.yieldBonusApr}% bonus APR
                  </Badge>
                )}
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">{deal.productName}</h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                {deal.description || `Supply chain financing deal for ${deal.pymeName}`}
              </p>
            </div>

            {deal.status === 'awaiting_funding' && (
              isFundingOpen ? (
                deal.escrowAddress ? (
                userType === 'investor' ? (
                  <Dialog open={isFundingDialogOpen} onOpenChange={setIsFundingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2 shadow-sm">
                        <Wallet className="h-5 w-5" aria-hidden />
                        Fund {formatCurrency(deal.priceUSDC)}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Fund Deal</DialogTitle>
                        <DialogDescription>
                          Connect your Stellar wallet to fund this deal with USDC. Your wallet will be recorded as the investor for this deal.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Deal Amount</Label>
                          <div className="rounded-lg border border-border bg-muted/50 p-3">
                            <p className="text-2xl font-bold">${deal.priceUSDC.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">USDC on Stellar</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Expected Return</Label>
                          <div className="rounded-lg border border-success bg-success/5 p-3">
                            <p className="text-2xl font-bold text-success">
                              {deal.yieldAPR ?? 0}% APR
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ${((deal.priceUSDC * ((deal.yieldAPR ?? 0) / 100) * (deal.term / 365))).toFixed(2)} profit in {deal.term} days
                            </p>
                          </div>
                        </div>

                        {!isConnected ? (
                          <Button type="button" onClick={handleConnect} className="w-full">
                            <Wallet className="mr-2 h-4 w-4" aria-hidden />
                            Connect Stellar Wallet
                          </Button>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Funding from</Label>
                              <Input
                                value={walletInfo?.address ?? ''}
                                disabled
                                className="font-mono text-xs"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleFundDeal}
                              className="w-full"
                              disabled={isFunding}
                            >
                              {isFunding ? 'Funding…' : 'Confirm & Fund Deal'}
                            </Button>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    {userType
                      ? 'Only investors can fund deals.'
                      : 'Sign in as an investor to fund this deal.'}
                  </div>
                )
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    Escrow deploying — refresh shortly to fund.
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    Funding window expired.
                  </div>
                  {isPyme && (
                    <Dialog
                      open={extendFundingDialogOpen}
                      onOpenChange={setExtendFundingDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline">
                          Extend funding window
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Extend funding window</DialogTitle>
                          <DialogDescription>
                            Choose how many days to extend this deal. Extension is
                            only allowed while the deal is unfunded.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="extend-days">Additional days</Label>
                            <Input
                              id="extend-days"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              value={extendFundingDays}
                              onChange={(e) => setExtendFundingDays(e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={handleExtendFundingWindow}
                            disabled={isExtendingFundingWindow}
                            className="w-full"
                          >
                            {isExtendingFundingWindow
                              ? 'Extending…'
                              : 'Confirm extension'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              )
            )}

            {deal.status === 'awaiting_funding' && deal.fundingExpiresAt && (
              <p className="mt-3 text-sm text-muted-foreground">
                Funding deadline: {formatDate(deal.fundingExpiresAt)}
                {isFundingOpen && fundingRemainingMs != null && fundingRemainingMs > 0
                  ? ` (${formatFundingRemaining(fundingRemainingMs)})`
                  : ''}
              </p>
            )}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(deal.priceUSDC)}</p>
              <p className="text-[11px] text-muted-foreground">USDC</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-center ${deal.yieldAPR ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30'}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">APR</p>
              {deal.yieldAPR ? (
                <p className="mt-1 text-xl font-bold tabular-nums text-success">{deal.yieldAPR.toFixed(1)}%</p>
              ) : (
                <p className="mt-1 text-xl text-muted-foreground">—</p>
              )}
              <p className="text-[11px] text-muted-foreground">yield</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Term</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{deal.term}</p>
              <p className="text-[11px] text-muted-foreground">days</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quantity</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{deal.quantity.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">units</p>
            </div>
          </div>
        </div>

        {/* PyME: Confirm delivery dialog (second milestone only) */}
        <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm delivery</DialogTitle>
              <DialogDescription>
                Confirm that you received the product. This approves the final 50% milestone on-chain;
                admin will then release the funds to the supplier. The PyME (buyer) confirms delivery;
                admin can release funds from the admin panel after confirmation.
                Connect your Stellar wallet to sign.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proof-notes">Notes (optional)</Label>
                <Textarea
                  id="proof-notes"
                  placeholder="e.g. Received in good condition, date received…"
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proof-url">Document URL (optional)</Label>
                <Input
                  id="proof-url"
                  type="url"
                  placeholder="https://…"
                  value={proofDocumentUrl}
                  onChange={(e) => setProofDocumentUrl(e.target.value)}
                />
              </div>
              {!isConnected ? (
                <Button type="button" onClick={handleConnect} className="w-full">
                  <Wallet className="mr-2 h-4 w-4" aria-hidden />
                  Connect Stellar wallet
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirmDelivery}
                  disabled={isSubmittingProof}
                  className="w-full"
                >
                  {isSubmittingProof ? 'Confirming…' : 'Confirm delivery'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Milestones */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Payment Milestones</CardTitle>
                    <CardDescription className="mt-1">
                      Funds released in stages as delivery is confirmed on-chain
                    </CardDescription>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                    {completedMilestones}/{deal.milestones.length}
                  </span>
                </div>
                <Progress value={progressPercentage} className="mt-4 h-1.5" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deal.milestones.map((milestone, index) => {
                    const milestoneAmount = (deal.priceUSDC * milestone.percentage) / 100
                    const isDone = milestone.status === 'completed'
                    const isActive = milestone.status === 'in_progress'
                    const isDisputed = milestone.status === 'disputed'

                    return (
                      <div
                        key={milestone.id}
                        className={`rounded-xl border-2 p-4 transition-colors ${
                          isDone
                            ? 'border-success/30 bg-success/5'
                            : isDisputed
                              ? 'border-destructive/30 bg-destructive/5'
                              : isActive
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Step indicator */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              isDone
                                ? 'bg-success text-success-foreground'
                                : isDisputed
                                  ? 'bg-destructive text-destructive-foreground'
                                  : isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold">{milestone.name}</h4>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isDone
                                    ? 'bg-success/10 text-success'
                                    : isActive
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {milestone.percentage}%
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                              <span className="font-medium tabular-nums">
                                {formatCurrency(milestoneAmount)} USDC
                              </span>
                              {isDone && milestone.completedAt && (
                                <span className="text-muted-foreground">
                                  Completed {formatDate(milestone.completedAt)}
                                </span>
                              )}
                              {isActive && (
                                <span className="text-primary">
                                  {isShipmentMilestone(milestone.name, index, deal.milestones.length)
                                    ? 'Release requested — awaiting admin approval'
                                    : 'Delivery confirmed — awaiting admin release'}
                                </span>
                              )}
                            </div>

                            {milestone.proofNotes && !isDone && (
                              <p className="mt-1 text-xs text-muted-foreground">{milestone.proofNotes}</p>
                            )}

                            {/* Role-specific actions */}
                            {milestone.status === 'pending' &&
                              deal.status !== 'awaiting_funding' &&
                              deal.escrowAddress && (
                                <div className="mt-3">
                                  {isDeliveryMilestone(milestone.name, index, deal.milestones.length) && isSupplier && (
                                    <p className="text-xs text-muted-foreground">
                                      The PyME (buyer) will confirm this milestone when they receive the goods.
                                    </p>
                                  )}
                                  {isShipmentMilestone(milestone.name, index, deal.milestones.length) && isSupplier && (
                                    <Button
                                      size="sm"
                                      type="button"
                                      onClick={() => handleAcceptOrder(index, milestone.id)}
                                      disabled={acceptingMilestoneId === milestone.id}
                                    >
                                      {acceptingMilestoneId === milestone.id
                                        ? 'Accepting…'
                                        : 'Accept order & request release'}
                                    </Button>
                                  )}
                                  {isDeliveryMilestone(milestone.name, index, deal.milestones.length) && (isPyme || isAdmin) && (
                                    <Button
                                      size="sm"
                                      variant={isPyme ? 'default' : 'outline'}
                                      type="button"
                                      onClick={() => openProofDialog(index, milestone.id)}
                                      disabled={confirmingDeliveryMilestoneId === milestone.id}
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                                      {confirmingDeliveryMilestoneId === milestone.id
                                        ? 'Confirming…'
                                        : 'Confirm delivery'}
                                    </Button>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tabs: Details, On-Chain, Documents */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="onchain">On-Chain</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm font-medium">PyME (Buyer)</p>
                        {deal.pymeId ? (
                          <Link
                            href={`/pymes/${deal.pymeId}`}
                            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {deal.pymeName}
                          </Link>
                        ) : (
                          <p className="text-sm text-muted-foreground">{deal.pymeName}</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium">Supplier</p>
                        {deal.supplierId ? (
                          <Link
                            href={`/suppliers/${deal.supplierId}`}
                            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {deal.supplier}
                          </Link>
                        ) : (
                          <p className="text-sm text-muted-foreground">{deal.supplier}</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(deal.createdAt)}
                        </p>
                      </div>
                      {deal.fundedAt && (
                        <div>
                          <p className="mb-1 text-sm font-medium">Funded</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(deal.fundedAt)}
                          </p>
                        </div>
                      )}
                      {deal.fundingExpiresAt && (
                        <div>
                          <p className="mb-1 text-sm font-medium">Funding deadline</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(deal.fundingExpiresAt)}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="mb-1 text-sm font-medium">Funding window</p>
                        <p className="text-sm text-muted-foreground">
                          {deal.fundingWindowDays ?? '—'} days
                          {deal.extensionCount > 0 ? ` · ${deal.extensionCount} extension(s)` : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="onchain" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Blockchain Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {deal.escrowAddress ? (
                      <>
                        <div>
                          <p className="mb-1 text-sm font-medium">Escrow Contract</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 rounded bg-muted px-2 py-1 text-xs">
                              {deal.escrowAddress}
                            </code>
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={`https://viewer.trustlesswork.com/${deal.escrowAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View escrow in TrustlessWork"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={`https://stellar.expert/explorer/public/contract/${deal.escrowAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on Stellar Expert"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                        {deal.investorAddress && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Investor Address</p>
                            <code className="block rounded bg-muted px-2 py-1 text-xs">
                              {deal.investorAddress}
                            </code>
                          </div>
                        )}
                        {deal.supplierAddress && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Supplier Address</p>
                            <code className="block rounded bg-muted px-2 py-1 text-xs">
                              {deal.supplierAddress}
                            </code>
                          </div>
                        )}
                        {indexerEscrow && (
                          <>
                            <Separator className="my-4" />
                            <div>
                              <p className="mb-2 text-sm font-medium">From indexer (on-chain state)</p>
                              {indexerEscrow.balance != null && (
                                <p className="text-sm text-muted-foreground">
                                  Balance: {indexerEscrow.balance.toLocaleString()} (trustline units)
                                </p>
                              )}
                              {indexerEscrow.milestones?.length ? (
                                <div className="mt-2 space-y-1">
                                  {indexerEscrow.milestones.map((m: { status?: string; amount?: number; description?: string }, i: number) => (
                                    <p key={`indexer-milestone-${i}-${m.status ?? ''}`} className="text-xs text-muted-foreground">
                                      Milestone {i}: {m.status ?? '—'} {m.amount != null ? `(${m.amount})` : ''}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <span>Escrow contract will be deployed after funding</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deal Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Documents will appear here after milestones
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Return calculator — only for open deals */}
            {isFundingOpen && deal.yieldAPR != null && (
              <Card className="border-success/30 bg-success/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-success">
                    <TrendingUp className="h-4 w-4" aria-hidden />
                    Investor return
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <p className="text-sm text-muted-foreground">Principal</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(deal.priceUSDC)}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-sm text-muted-foreground">
                      Profit ({deal.term}d @ {deal.yieldAPR.toFixed(1)}%)
                    </p>
                    <p className="font-semibold tabular-nums text-success">
                      +{formatCurrency(Math.round(deal.priceUSDC * (deal.yieldAPR / 100) * (deal.term / 365)))}
                    </p>
                  </div>
                  <Separator />
                  <div className="flex items-end justify-between">
                    <p className="text-sm font-medium">Total repayment</p>
                    <p className="text-lg font-bold tabular-nums">
                      {formatCurrency(Math.round(deal.priceUSDC * (1 + (deal.yieldAPR / 100) * (deal.term / 365))))}
                    </p>
                  </div>
                  {(deal.yieldBonusApr ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Includes {deal.yieldBonusApr}% bonus APR offered by the PyME.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stakeholders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Stakeholders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    icon: <Package className="h-4 w-4 text-accent" aria-hidden />,
                    bg: 'bg-accent/10',
                    label: 'PyME (Buyer)',
                    name: deal.pymeName,
                    href: deal.pymeId ? `/pymes/${deal.pymeId}` : undefined,
                  },
                  {
                    icon: <TrendingUp className="h-4 w-4 text-success" aria-hidden />,
                    bg: 'bg-success/10',
                    label: 'Investor',
                    name: deal.investorName ?? 'Awaiting funding',
                    href: deal.investorId && deal.investorName ? `/investors/${deal.investorId}` : undefined,
                  },
                  {
                    icon: <Building2 className="h-4 w-4 text-primary" aria-hidden />,
                    bg: 'bg-primary/10',
                    label: 'Supplier',
                    name: deal.supplier,
                    href: deal.supplierId ? `/suppliers/${deal.supplierId}` : undefined,
                  },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.bg}`}>
                      {s.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      {s.href ? (
                        <Link
                          href={s.href}
                          className="group flex items-center gap-0.5 text-sm font-medium hover:text-accent hover:underline"
                        >
                          <span className="truncate">{s.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-muted-foreground">{s.name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" aria-hidden />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-l border-border pl-5">
                  <li className="relative">
                    <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-foreground ring-2 ring-background" />
                    <p className="text-sm font-medium">Deal created</p>
                    <p className="text-xs text-muted-foreground">{formatDate(deal.createdAt)}</p>
                  </li>
                  {deal.fundedAt ? (
                    <li className="relative">
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-success ring-2 ring-background" />
                      <p className="text-sm font-medium">Funded</p>
                      <p className="text-xs text-muted-foreground">{formatDate(deal.fundedAt)}</p>
                    </li>
                  ) : (
                    <li className="relative">
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-background" />
                      <p className="text-sm text-muted-foreground">Awaiting funding</p>
                    </li>
                  )}
                  {deal.completedAt ? (
                    <li className="relative">
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-success ring-2 ring-background" />
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-muted-foreground">{formatDate(deal.completedAt)}</p>
                    </li>
                  ) : (
                    <li className="relative">
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-background" />
                      <p className="text-sm text-muted-foreground">Awaiting completion</p>
                    </li>
                  )}
                </ol>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4" aria-hidden />
                  Escrow & trust
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  'Non-custodial escrow on Stellar (TrustlessWork)',
                  'Milestone-gated payment release',
                  'Wallet-signed transactions — no third-party custody',
                  'Dispute resolution built into the contract',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    <p className="text-xs text-muted-foreground">{point}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
