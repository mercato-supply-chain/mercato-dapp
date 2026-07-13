'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Wallet, ExternalLink, Building2, Rocket } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { useI18n } from '@/lib/i18n/provider'
import { formatCurrency } from '@/lib/format'
import {
  DEFAULT_FIRST_MILESTONE_PERCENT,
  repaymentMilestoneAmount,
} from '@/lib/deals/fees'
import type { CreateEscrowItem } from '@/lib/admin/types'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'

interface CreateRepaymentEscrowsProps {
  items: CreateEscrowItem[]
}

export function CreateRepaymentEscrows({ items }: CreateRepaymentEscrowsProps) {
  const { t, locale } = useI18n()
  const numLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const { isWorking, deployRepaymentEscrow } = useRepaymentEscrow()
  const [deployingId, setDeployingId] = useState<string | null>(null)
  const [percents, setPercents] = useState<Record<string, string>>({})

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminCreateEscrow.empty')}</p>
    )
  }

  const handleDeploy = async (item: CreateEscrowItem) => {
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
    if (!item.investorAddress) {
      toast.error(t('adminCreateEscrow.investorMissing'))
      return
    }

    const raw = percents[item.dealId]
    const percent = Number.parseFloat(raw ?? String(DEFAULT_FIRST_MILESTONE_PERCENT))
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast.error(t('adminCreateEscrow.percentInvalid'))
      return
    }

    setDeployingId(item.dealId)
    try {
      await deployRepaymentEscrow({
        dealId: item.dealId,
        adminAddress: walletInfo.address,
        investorAddress: item.investorAddress,
        principal: item.principal,
        aprPercent: item.aprPercent,
        termDays: item.termDays,
        productName: item.dealProductName || item.dealTitle,
        firstMilestonePercent: percent,
        provider,
      })
      toast.success(t('adminCreateEscrow.deploySuccess'))
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('adminCreateEscrow.deployFail'),
      )
    } finally {
      setDeployingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const percent = Number.parseFloat(
          percents[item.dealId] ?? String(DEFAULT_FIRST_MILESTONE_PERCENT),
        )
        const firstAmount = Number.isFinite(percent)
          ? repaymentMilestoneAmount(item.totalGrossed, percent)
          : item.defaultFirstMilestoneAmount
        const busy = deployingId === item.dealId || isWorking

        return (
          <div
            key={item.dealId}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/deals/${item.dealId}`}
                    className="font-semibold hover:underline"
                  >
                    {item.dealProductName || item.dealTitle}
                  </Link>
                  <Badge variant="secondary">{t('adminCreateEscrow.badge')}</Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.pymeName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {t('adminCreateEscrow.totalLine', {
                      amount: `$${item.totalGrossed.toLocaleString(numLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`,
                    })}
                  </div>
                </div>
                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor={`first-pct-${item.dealId}`}>
                    {t('adminCreateEscrow.firstPercentLabel')}
                  </Label>
                  <Input
                    id={`first-pct-${item.dealId}`}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={percents[item.dealId] ?? String(DEFAULT_FIRST_MILESTONE_PERCENT)}
                    onChange={(e) =>
                      setPercents((prev) => ({
                        ...prev,
                        [item.dealId]: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('adminCreateEscrow.firstAmountPreview', {
                      amount: formatCurrency(firstAmount),
                    })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {!isConnected ? (
                  <Button type="button" onClick={handleConnect} size="sm">
                    <Wallet className="mr-2 h-4 w-4" aria-hidden />
                    {t('adminPending.connectWalletShort')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleDeploy(item)}
                    disabled={busy}
                  >
                    <Rocket className="mr-2 h-4 w-4" aria-hidden />
                    {busy
                      ? t('adminCreateEscrow.deploying')
                      : t('adminCreateEscrow.deployCta')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/deals/${item.dealId}`}>
                    {t('adminPending.viewDeal')}{' '}
                    <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
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
