'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, ExternalLink, Building2 } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { useRepaymentCommandRefresh } from '@/hooks/use-repayment-command-refresh'
import { useI18n } from '@/lib/i18n/provider'
import type { CreateEscrowItem } from '@/lib/admin/types'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import { revalidateAuthoritativeState } from '@/lib/trustless/repayment-deployment-guard'
import { buildRepaymentConfigSnapshot } from '@/lib/trustless/repayment-config-snapshot'
import { EscrowDeploymentReviewDialog } from '@/components/admin/repayment-escrow/escrow-deployment-review-dialog'

interface CreateRepaymentEscrowsProps {
  items: CreateEscrowItem[]
  onAfterCommand?: () => void | Promise<void>
}

export function CreateRepaymentEscrows({ items, onAfterCommand }: CreateRepaymentEscrowsProps) {
  const { t, locale } = useI18n()
  const numLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const { isWorking, deployRepaymentEscrow } = useRepaymentEscrow()
  const { refreshAfterCommand } = useRepaymentCommandRefresh()
  const completeCommand = onAfterCommand ?? refreshAfterCommand

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminCreateEscrow.empty')}</p>
    )
  }

  /**
   * Called by the review dialog only after the admin reviewed the
   * draft and the authoritative revalidation passed. The draft arriving here
   * is already validated; deploy never regenerates its values.
   */
  const handleDeployReviewed = async (
    item: CreateEscrowItem,
    draft: RepaymentEscrowDeploymentDraft,
    audit?: { generated: RepaymentEscrowDeploymentDraft | null; reviewTimestamp: string | null },
  ) => {
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

    await deployRepaymentEscrow({
      dealId: item.dealId,
      adminAddress: walletInfo.address,
      provider,
      draft,
      termDays: item.termDays,
      audit: audit ? { generatedDraft: audit.generated, reviewTimestamp: audit.reviewTimestamp } : undefined,
    })
    toast.success(t('adminCreateEscrow.deploySuccess'))
    await completeCommand()
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
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
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {!isConnected ? (
                  <Button type="button" onClick={handleConnect} size="sm">
                    <Wallet className="mr-2 h-4 w-4" aria-hidden />
                    {t('adminPending.connectWalletShort')}
                  </Button>
                ) : (
                  <EscrowDeploymentReviewDialog
                    item={item}
                    signerAddress={walletInfo?.address ?? ''}
                    triggerDisabled={isWorking}
                    onSubmitReviewed={(draft, audit) => handleDeployReviewed(item, draft, audit ?? undefined)}
                    onRevalidate={(draft) =>
                      revalidateAuthoritativeState(
                        draft,
                        item.dealId,
                        buildRepaymentConfigSnapshot(),
                      )
                    }
                  />
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
