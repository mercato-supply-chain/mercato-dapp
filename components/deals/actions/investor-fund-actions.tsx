'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { Clock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DealFundDialog } from '@/components/deals/deal-fund-dialog'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/format'
import { useI18n } from '@/lib/i18n/provider'
import { buildUsdcSplitPaymentXdr } from '@/lib/stellar/build-usdc-split-payment'
import { buildAssembledSorobanInvoke, bytes32, addressVal } from '@/lib/stellar/build-soroban-invoke'
import { getAppStellarNetwork } from '@/lib/stellar/network-config'
import { submitSignedTransaction } from '@/lib/stellar-submit'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { investorFundingTotal } from '@/lib/deals/fees'
import { usePollarSession } from '@/providers/pollar-provider'
import { useWallet } from '@/hooks/use-wallet'

type Supabase = ReturnType<typeof createClient>

interface SubmittedFundingTx {
  dealId: string
  userId: string
  walletAddress: string
  principal: number
  txHash: string
}

interface InvestorFundingControllerValue {
  open: boolean
  setOpen: (open: boolean) => void
  openDialog: () => void
  fundingTotal: number
  canOpenDialog: boolean
}

const InvestorFundingContext = createContext<InvestorFundingControllerValue | null>(null)

export interface InvestorFundingProviderProps {
  deal: Deal
  isFundingOpen: boolean
  children: ReactNode
}

export interface InvestorFundActionsProps {
  deal: Deal
  isFundingOpen: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  userId: string | null
}

/**
 * Coordinates open/close state between the desktop hero CTA (`InvestorFundActions`)
 * and the mobile sticky CTA (`InvestorMobileFundBar`) so the page mounts only a
 * single `DealFundDialog` instance.
 */
export function InvestorFundingProvider({
  deal,
  isFundingOpen,
  children,
}: InvestorFundingProviderProps) {
  const [open, setOpen] = useState(false)
  const fundingTotal = deal.investorFundingTotal || investorFundingTotal(deal.priceUSDC)
  const canOpenDialog =
    deal.status === 'awaiting_funding' && isFundingOpen && Boolean(deal.supplierAddress)

  const openDialog = useCallback(() => {
    setOpen(true)
  }, [])

  const value = useMemo<InvestorFundingControllerValue>(
    () => ({
      open,
      setOpen,
      openDialog,
      fundingTotal,
      canOpenDialog,
    }),
    [canOpenDialog, fundingTotal, open, openDialog],
  )

  return (
    <InvestorFundingContext.Provider value={value}>
      {children}
    </InvestorFundingContext.Provider>
  )
}

export function InvestorFundActions({
  deal,
  isFundingOpen,
  supabase,
  fetchDeal,
  onDealUpdate,
}: InvestorFundActionsProps) {
  const { t } = useI18n()
  const pollar = usePollarSession()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const sharedController = useContext(InvestorFundingContext)
  const [localOpen, setLocalOpen] = useState(false)
  const [isFunding, setIsFunding] = useState(false)
  const fundingLockRef = useRef(false)
  // Cache on-chain txHash bound to (dealId, userId, walletAddress, principal) so DB sync retries never double-spend or reuse stale hashes across parameters.
  const submittedTxRef = useRef<SubmittedFundingTx | null>(null)

  const walletAddress = walletInfo?.address
  const isFundingDialogOpen = sharedController ? sharedController.open : localOpen
  const setIsFundingDialogOpen = sharedController ? sharedController.setOpen : setLocalOpen

  const verifyInvestorSession = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error(t('dealDetail.toastFundSignIn'))
      return null
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()
    if (profile?.user_type !== 'investor') {
      toast.error(t('dealDetail.toastFundOnlyInvestors'))
      return null
    }
    return user
  }

  const fundRwaDeal = async (contributionPrincipal?: number) => {
    if (!walletAddress || fundingLockRef.current) return
    if (!deal.rwaAssetId) {
      toast.error('This deal is waiting for its credit asset to be issued.')
      return
    }
    if (provider === 'pollar') {
      toast.error('RWA funding needs an external Stellar wallet.')
      return
    }
    const principal = contributionPrincipal ?? deal.priceUSDC
    fundingLockRef.current = true
    setIsFunding(true)
    try {
      const user = await verifyInvestorSession()
      if (!user) return

      const prepared = await fetch('/api/rwa/contributions/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: deal.rwaAssetId,
          amount: principal,
          walletAddress,
          idempotencyKey: `${deal.id}:${walletAddress}:${principal}`,
        }),
      })
      const preparedBody = await prepared.json()
      if (!prepared.ok) throw new Error(preparedBody.message ?? 'Could not reserve this contribution')
      const call = preparedBody.call as {
        contractId: string
        args: { investor: string; principalUnits: string; nonce: string; contributionRef: string }
      }
      const unsignedXdr = await buildAssembledSorobanInvoke({
        sourceAddress: walletAddress,
        contractId: call.contractId,
        functionName: 'contribute',
        network: getAppStellarNetwork(),
        args: [
          addressVal(call.args.investor),
          nativeToScVal(call.args.principalUnits, { type: 'i128' }),
          nativeToScVal(call.args.nonce, { type: 'u64' }),
          bytes32(call.args.contributionRef),
        ],
      })
      const signedXdr = await signTransaction({
        unsignedTransaction: unsignedXdr,
        address: walletAddress,
      })
      if (!signedXdr) throw new Error(t('dealDetail.errorSignedTxMissing'))
      const result = await submitSignedTransaction(signedXdr)
      if (!result.successful || !result.hash) throw new Error(t('dealDetail.errorTxFailed'))

      await fetch('/api/rwa/contributions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: preparedBody.attemptId, txHash: result.hash }),
      })
      const confirmed = await fetch('/api/rwa/contributions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: preparedBody.attemptId, txHash: result.hash }),
      })
      const confirmedBody = await confirmed.json()
      if (!confirmed.ok) throw new Error(confirmedBody.message ?? 'Contribution was not confirmed')

      // Persist investor wallet for repayment escrow receiver role
      await supabase.from('profiles').update({ address: walletAddress }).eq('id', user.id)
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success(
        confirmedBody.targetReached
          ? 'Funding target reached. The supplier is paid only after settlement.'
          : 'Contribution recorded. The supplier is paid once the target is reached.',
      )
      setIsFundingDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('dealDetail.toastFundFailDefault')
      toast.error(message)
    } finally {
      fundingLockRef.current = false
      setIsFunding(false)
    }
  }

  const handleFundDeal = async (contributionPrincipal?: number) => {
    if (deal.rwaOptedIn) {
      await fundRwaDeal(contributionPrincipal)
      return
    }
    if (!deal || !walletAddress || fundingLockRef.current) return
    if (!deal.supplierAddress) {
      toast.error(t('dealDetail.toastSupplierAddressMissing'))
      return
    }
    if (!MERCATO_PLATFORM_ADDRESS) {
      toast.error(t('createDeal.platformMissing'))
      return
    }
    fundingLockRef.current = true
    setIsFunding(true)
    const principal = contributionPrincipal ?? deal.priceUSDC
    try {
      const user = await verifyInvestorSession()
      if (!user) return

      const cachedSubmission = submittedTxRef.current
      const wasCachedRetry = Boolean(
        cachedSubmission &&
          cachedSubmission.dealId === deal.id &&
          cachedSubmission.userId === user.id &&
          cachedSubmission.walletAddress === walletAddress &&
          cachedSubmission.principal === principal,
      )
      let fundingTxHash = wasCachedRetry ? cachedSubmission?.txHash : undefined

      if (!fundingTxHash) {
        // Classic USDC split payment: principal -> supplier, 1% platform fee -> Mercato
        const unsignedXdr = await buildUsdcSplitPaymentXdr({
          sourceAddress: walletAddress,
          supplierAddress: deal.supplierAddress,
          platformAddress: MERCATO_PLATFORM_ADDRESS,
          principal,
        })

        if (provider === 'pollar') {
          fundingTxHash = await pollar.signAndSubmitTx(unsignedXdr)
        } else {
          const signedXdr = await signTransaction({
            unsignedTransaction: unsignedXdr,
            address: walletAddress,
          })
          if (!signedXdr) throw new Error(t('dealDetail.errorSignedTxMissing'))
          const result = await submitSignedTransaction(signedXdr)
          if (!result.successful) {
            throw new Error(t('dealDetail.errorTxFailed'))
          }
          fundingTxHash = result.hash
        }

        if (fundingTxHash) {
          submittedTxRef.current = {
            dealId: deal.id,
            userId: user.id,
            walletAddress,
            principal,
            txHash: fundingTxHash,
          }
        }
      }

      // Repayment due is set only after SMB confirms delivery
      const fundedAt = new Date()

      const { data: updatedRow, error: updateError } = await supabase
        .from('deals')
        .update({
          investor_id: user.id,
          status: 'funded',
          funded_at: fundedAt.toISOString(),
          funding_tx_hash: fundingTxHash ?? null,
        })
        .eq('id', deal.id)
        .eq('status', 'seeking_funding')
        .is('investor_id', null)
        .select('id')
        .maybeSingle()
      if (updateError) throw updateError

      const finalizeClassicFunding = async (confirmedDeal: Deal) => {
        // Persist investor wallet for repayment escrow receiver role
        await supabase
          .from('profiles')
          .update({ address: walletAddress })
          .eq('id', user.id)

        submittedTxRef.current = null
        onDealUpdate(confirmedDeal)
        toast.success(t('dealDetail.toastFundSuccess'))
        setIsFundingDialogOpen(false)

        if (deal.pymeId) {
          fetch('/api/referral/milestone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestone: 'deal_funded', dealId: deal.id }),
          }).catch(() => {})
        }
      }

      if (!updatedRow) {
        const latestDeal = await fetchDeal()
        if (
          wasCachedRetry &&
          latestDeal &&
          latestDeal.investorId === user.id &&
          latestDeal.status !== 'awaiting_funding'
        ) {
          await finalizeClassicFunding(latestDeal)
          return
        }
        if (latestDeal) onDealUpdate(latestDeal)
        throw new Error(t('dealDetail.errorFundingDbSync'))
      }

      const updated = await fetchDeal()
      if (!updated || updated.status === 'awaiting_funding' || updated.investorId !== user.id) {
        throw new Error(t('dealDetail.errorFundingDbSync'))
      }
      await finalizeClassicFunding(updated)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastFundFailDefault')
      console.error('Fund deal error:', err)
      toast.error(message)
    } finally {
      fundingLockRef.current = false
      setIsFunding(false)
    }
  }

  if (deal.status !== 'awaiting_funding') return null

  if (!isFundingOpen) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.fundingExpired')}
      </div>
    )
  }

  if (!deal.supplierAddress) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.supplierAddressMissing')}
      </div>
    )
  }

  return (
    <DealFundDialog
      deal={deal}
      open={isFundingDialogOpen}
      onOpenChange={setIsFundingDialogOpen}
      isFunding={isFunding}
      isConnected={isConnected}
      walletAddress={walletAddress}
      onConnect={() => void handleConnect()}
      onConfirmFund={(contributionPrincipal) => void handleFundDeal(contributionPrincipal)}
    />
  )
}

/**
 * Sticky mobile CTA bar (`lg:hidden`) that opens the single shared `DealFundDialog`
 * managed by `InvestorFundingProvider` without mounting a duplicate dialog portal.
 */
export function InvestorMobileFundBar() {
  const { t } = useI18n()
  const controller = useContext(InvestorFundingContext)
  if (!controller || !controller.canOpenDialog) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur lg:hidden">
      <Button
        type="button"
        size="lg"
        className="w-full gap-2 shadow-sm"
        onClick={controller.openDialog}
      >
        <Wallet className="h-5 w-5" aria-hidden />
        {t('deals.fundThisDeal')} · {formatCurrency(controller.fundingTotal)}
      </Button>
    </div>
  )
}
