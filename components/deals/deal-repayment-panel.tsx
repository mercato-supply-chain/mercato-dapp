'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'

type Supabase = ReturnType<typeof createClient>

interface DealRepaymentPanelProps {
  deal: Deal
  isPyme: boolean
  isAdmin: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

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
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveAndReleaseRepayment,
  } = useRepaymentEscrow()
  const [busy, setBusy] = useState(false)

  if (deal.status === 'awaiting_funding') return null

  const apr = deal.yieldAPR ?? 0
  const { profit } = computeInvestorReturns(deal.priceUSDC, apr, deal.term)
  const investorPayout = investorPayoutAmount(deal.priceUSDC, profit)
  const escrowAmount = repaymentEscrowAmount(deal.priceUSDC, profit)
  const status = deal.repaymentStatus ?? 'none'

  const refresh = async () => {
    const updated = await fetchDeal()
    if (updated) onDealUpdate(updated)
  }

  const handleDeploy = async () => {
    if (!walletInfo?.address) {
      handleConnect()
      return
    }
    if (!deal.investorAddress) {
      toast.error(t('dealDetail.repaymentInvestorAddressMissing'))
      return
    }
    setBusy(true)
    try {
      await deployRepaymentEscrow({
        dealId: deal.id,
        pymeAddress: walletInfo.address,
        investorAddress: deal.investorAddress,
        principal: deal.priceUSDC,
        aprPercent: apr,
        termDays: deal.term,
        productName: deal.productName,
        provider,
      })
      await refresh()
      toast.success(t('dealDetail.repaymentEscrowDeployed'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentDeployFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleFund = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
    setBusy(true)
    try {
      await fundRepaymentEscrow({
        contractId: deal.escrowAddress,
        pymeAddress: walletInfo.address,
        amount: escrowAmount,
        provider,
      })
      const { error } = await supabase
        .from('deals')
        .update({
          repayment_status: 'funded',
          escrow_status: 'active',
        })
        .eq('id', deal.id)
      if (error) throw error
      await refresh()
      toast.success(t('dealDetail.repaymentFunded'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentFundFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleRelease = async () => {
    if (!walletInfo?.address || !deal.escrowAddress) return
    if (walletInfo.address !== MERCATO_PLATFORM_ADDRESS && !isAdmin) {
      toast.error(t('dealDetail.repaymentReleaseOnlyPlatform'))
      return
    }
    setBusy(true)
    try {
      await approveAndReleaseRepayment({
        contractId: deal.escrowAddress,
        releaseSigner: walletInfo.address,
        provider,
      })
      const { error } = await supabase
        .from('deals')
        .update({
          repayment_status: 'released',
          escrow_status: 'completed',
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', deal.id)
      if (error) throw error
      await refresh()
      toast.success(t('dealDetail.repaymentReleased'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('dealDetail.repaymentReleaseFail'))
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
        </div>

        {status === 'none' && isPyme ? (
          <div className="space-y-2">
            {!isConnected ? (
              <Button type="button" onClick={handleConnect} className="w-full">
                {t('dealDetail.connectStellarWallet')}
              </Button>
            ) : (
              <Button type="button" onClick={handleDeploy} disabled={working} className="w-full">
                {working
                  ? t('dealDetail.repaymentDeploying')
                  : t('dealDetail.repaymentDeployCta')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {t('dealDetail.repaymentDeployHint')}
            </p>
          </div>
        ) : null}

        {status === 'escrow_initialized' && isPyme ? (
          <div className="space-y-2">
            {!isConnected ? (
              <Button type="button" onClick={handleConnect} className="w-full">
                {t('dealDetail.connectStellarWallet')}
              </Button>
            ) : (
              <Button type="button" onClick={handleFund} disabled={working} className="w-full">
                {working
                  ? t('dealDetail.repaymentFunding')
                  : t('dealDetail.repaymentFundCta', {
                      amount: formatCurrency(escrowAmount),
                    })}
              </Button>
            )}
          </div>
        ) : null}

        {status === 'funded' && (isAdmin || walletInfo?.address === MERCATO_PLATFORM_ADDRESS) ? (
          <Button type="button" onClick={handleRelease} disabled={working} className="w-full">
            {working
              ? t('dealDetail.repaymentReleasing')
              : t('dealDetail.repaymentReleaseCta')}
          </Button>
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
