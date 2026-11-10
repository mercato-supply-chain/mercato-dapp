'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock, Wallet } from 'lucide-react'
import { DealFundDialog } from '@/components/deals/deal-fund-dialog'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/format'
import { useI18n } from '@/lib/i18n/provider'
import { buildUsdcSplitPaymentXdr } from '@/lib/stellar/build-usdc-split-payment'
import { buildAssembledSorobanInvoke, bytes32, addressVal } from '@/lib/stellar/build-soroban-invoke'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { getAppStellarNetwork } from '@/lib/stellar/network-config'
import { submitSignedTransaction } from '@/lib/stellar-submit'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { investorFundingTotal } from '@/lib/deals/fees'
import { usePollarSession } from '@/providers/pollar-provider'
import { useWallet } from '@/hooks/use-wallet'

type Supabase = ReturnType<typeof createClient>

interface DealFundingPanelProps {
  deal: Deal
  isFundingOpen: boolean
  isPyme: boolean
  userType: string | null
  isConnected: boolean
  walletAddress: string | undefined
  onConnect: () => void
  canFund: boolean
  showMobileBar: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  userId: string | null
}

export function DealFundingPanel({
  deal,
  isFundingOpen,
  isPyme,
  userType,
  isConnected,
  walletAddress,
  onConnect,
  canFund,
  showMobileBar,
  supabase,
  fetchDeal,
  onDealUpdate,
  userId,
}: DealFundingPanelProps) {
  const { t } = useI18n()
  const pollar = usePollarSession()
  const { provider } = useWallet()
  const [isFunding, setIsFunding] = useState(false)
  const [isFundingDialogOpen, setIsFundingDialogOpen] = useState(false)
  const [extendFundingDialogOpen, setExtendFundingDialogOpen] = useState(false)
  const [extendFundingDays, setExtendFundingDays] = useState('7')
  const [isExtendingFundingWindow, setIsExtendingFundingWindow] = useState(false)

  const fundingTotal = deal.investorFundingTotal || investorFundingTotal(deal.priceUSDC)

  const fundRwaDeal = async (contributionPrincipal?: number) => {
    if (!walletAddress) return
    if (!deal.rwaAssetId) {
      toast.error('This deal is waiting for its credit asset to be issued.')
      return
    }
    if (provider === 'pollar') {
      toast.error('RWA funding needs an external Stellar wallet.')
      return
    }
    if (userType !== 'investor') {
      toast.error(t('dealDetail.toastFundOnlyInvestors'))
      return
    }
    const principal = contributionPrincipal ?? deal.priceUSDC
    setIsFunding(true)
    try {
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

      await supabase.from('profiles').update({ address: walletAddress }).eq('id', userId ?? '')
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
      setIsFunding(false)
    }
  }

  const settleSupplier = async () => {
    if (!deal.rwaAssetId) return
    setIsFunding(true)
    try {
      const response = await fetch('/api/rwa/settlements/supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: deal.rwaAssetId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message ?? 'Supplier settlement is not ready')
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success('Supplier settlement recorded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Supplier settlement failed')
    } finally {
      setIsFunding(false)
    }
  }

  const handleFundDeal = async (contributionPrincipal?: number) => {
    if (deal.rwaOptedIn) {
      await fundRwaDeal(contributionPrincipal)
      return
    }
    if (!deal || !walletAddress) return
    if (!deal.supplierAddress) {
      toast.error(t('dealDetail.toastSupplierAddressMissing'))
      return
    }
    if (!MERCATO_PLATFORM_ADDRESS) {
      toast.error(t('createDeal.platformMissing'))
      return
    }
    if (userType !== 'investor') {
      toast.error(t('dealDetail.toastFundOnlyInvestors'))
      return
    }
    setIsFunding(true)
    // Use the validated contribution principal from the dialog, or fall back to full deal price
    const principal = contributionPrincipal ?? deal.priceUSDC
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error(t('dealDetail.toastFundSignIn'))
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()
      if (profile?.user_type !== 'investor') {
        toast.error(t('dealDetail.toastFundOnlyInvestors'))
        return
      }

      const unsignedXdr = await buildUsdcSplitPaymentXdr({
        sourceAddress: walletAddress,
        supplierAddress: deal.supplierAddress,
        platformAddress: MERCATO_PLATFORM_ADDRESS,
        principal,
      })

      let fundingTxHash: string | undefined

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

      const fundedAt = new Date()

      const { error: updateError } = await supabase
        .from('deals')
        .update({
          investor_id: user.id,
          status: 'funded',
          funded_at: fundedAt.toISOString(),
          funding_tx_hash: fundingTxHash ?? null,
          // Repayment due is set only after SMB confirms delivery
        })
        .eq('id', deal.id)
      if (updateError) throw updateError

      // Persist investor wallet for repayment escrow receiver role
      await supabase
        .from('profiles')
        .update({ address: walletAddress })
        .eq('id', user.id)

      const updated = await fetchDeal()
      if (!updated || updated.status !== 'funded') {
        throw new Error(t('dealDetail.errorFundingDbSync'))
      }
      onDealUpdate(updated)
      toast.success(t('dealDetail.toastFundSuccess'))
      setIsFundingDialogOpen(false)

      if (deal.pymeId) {
        fetch('/api/referral/milestone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestone: 'deal_funded', dealId: deal.id }),
        }).catch(() => {})
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastFundFailDefault')
      console.error('Fund deal error:', err)
      toast.error(message)
    } finally {
      setIsFunding(false)
    }
  }

  const handleExtendFundingWindow = async () => {
    if (!deal || !userId) return
    if (!isPyme) {
      toast.error(t('dealDetail.toastOnlyPymeExtend'))
      return
    }
    if (deal.fundingStatus !== 'expired' || deal.status !== 'awaiting_funding') {
      toast.error(t('dealDetail.toastExtendNotEligibleDeal'))
      return
    }
    const nextWindowDays = Number(extendFundingDays)
    if (!Number.isInteger(nextWindowDays) || nextWindowDays <= 0) {
      toast.error(t('dealDetail.toastInvalidExtensionDays'))
      return
    }
    setIsExtendingFundingWindow(true)
    try {
      const nowIso = new Date().toISOString()
      const nextExpirationIso = new Date(
        Date.now() + nextWindowDays * 24 * 60 * 60 * 1000,
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
      if (!data) throw new Error(t('dealDetail.errorDealIneligibleExtendDb'))
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success(t('dealDetail.toastExtendSuccess'))
      setExtendFundingDialogOpen(false)
      setExtendFundingDays(String(nextWindowDays))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastExtendFail')
      console.error('Extend funding window error:', err)
      toast.error(message)
    } finally {
      setIsExtendingFundingWindow(false)
    }
  }

  const fundDialog = (
    <DealFundDialog
      deal={deal}
      open={isFundingDialogOpen}
      onOpenChange={setIsFundingDialogOpen}
      isFunding={isFunding}
      isConnected={isConnected}
      walletAddress={walletAddress}
      onConnect={onConnect}
      onConfirmFund={(contributionPrincipal) => void handleFundDeal(contributionPrincipal)}
    />
  )

  return (
    <>
      {userType === 'admin' && deal.rwaLifecycle === 'ready_to_settle' ? (
        <Button type="button" onClick={() => void settleSupplier()} disabled={isFunding}>
          {isFunding ? 'Settling supplier…' : 'Settle supplier'}
        </Button>
      ) : null}
      {deal.status === 'awaiting_funding' && (
        isFundingOpen ? (
          deal.supplierAddress ? (
            userType === 'investor' ? (
              fundDialog
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {userType
                  ? t('dealDetail.onlyInvestorsFund')
                  : t('dealDetail.signInInvestorFund')}
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {t('dealDetail.supplierAddressMissing')}
            </div>
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {t('dealDetail.fundingExpired')}
            </div>
            {isPyme && (
              <Dialog open={extendFundingDialogOpen} onOpenChange={setExtendFundingDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    {t('dealDetail.extendFundingCta')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t('dealDetail.extendTitle')}</DialogTitle>
                    <DialogDescription>{t('dealDetail.extendDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="extend-days">{t('dealDetail.additionalDays')}</Label>
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
                        ? t('dealDetail.extending')
                        : t('dealDetail.confirmExtension')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )
      )}

      {showMobileBar && canFund && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur lg:hidden">
          <DealFundDialog
            deal={deal}
            open={isFundingDialogOpen}
            onOpenChange={setIsFundingDialogOpen}
            isFunding={isFunding}
            isConnected={isConnected}
            walletAddress={walletAddress}
            onConnect={onConnect}
            onConfirmFund={(contributionPrincipal) => void handleFundDeal(contributionPrincipal)}
            trigger={
              <Button size="lg" className="w-full gap-2 shadow-sm">
                <Wallet className="h-5 w-5" aria-hidden />
                {t('deals.fundThisDeal')} · {formatCurrency(fundingTotal)}
              </Button>
            }
          />
        </div>
      )}
    </>
  )
}
