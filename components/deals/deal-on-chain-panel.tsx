'use client'

import type { ReactNode } from 'react'
import { AlertCircle, ExternalLink, ArrowRightLeft } from 'lucide-react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'
import {
  stellarExpertContractUrl,
  stellarExpertTxUrl,
} from '@/lib/stellar/explorer'
import { cn } from '@/lib/utils'

type DealOnChainPanelProps = {
  escrowAddress?: string
  fundingTxHash?: string
  indexerEscrow: GetEscrowsFromIndexerResponse | null
  compact?: boolean
}

function truncateId(id: string, head = 8, tail = 6) {
  if (id.length <= head + tail + 3) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

function OnChainIdentifier({
  value,
  compact = false,
  label,
  actions,
}: {
  value: string
  compact?: boolean
  label?: string
  actions?: ReactNode
}) {
  if (compact) {
    return (
      <div className="min-w-0 space-y-2">
        <code className="block w-full min-w-0 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed sm:text-xs">
          {truncateId(value)}
        </code>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-2">
      <CopyableCodeLine value={value} label={label} />
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

export function DealOnChainPanel({
  escrowAddress,
  fundingTxHash,
  indexerEscrow,
  compact = false,
}: DealOnChainPanelProps) {
  const { t } = useI18n()
  const hasActivity = Boolean(fundingTxHash || escrowAddress)

  if (!hasActivity) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.onChainActivityEmpty')}
      </p>
    )
  }

  return (
    <div className={cn('min-w-0', compact ? 'space-y-3' : 'space-y-4')}>
      {fundingTxHash ? (
        <div className="min-w-0">
          <SectionLabel>{t('dealDetail.onChainActivityTitle')}</SectionLabel>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-2">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('dealDetail.fundingPaymentTitle')}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {t('dealDetail.fundingPaymentDescription')}
                  </p>
                </div>
                <OnChainIdentifier
                  value={fundingTxHash}
                  compact={compact}
                  label={t('dealDetail.fundingPaymentTitle')}
                  actions={
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5" asChild>
                      <a
                        href={stellarExpertTxUrl(fundingTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Stellar Expert
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {escrowAddress ? (
        <div className="min-w-0">
          <SectionLabel>{t('dealDetail.escrowContract')}</SectionLabel>
          <OnChainIdentifier
            value={escrowAddress}
            compact={compact}
            label={t('dealDetail.escrowContract')}
            actions={
              <>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5" asChild>
                  <a
                    href={`https://viewer.trustlesswork.com/${escrowAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TrustlessWork
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5" asChild>
                  <a
                    href={stellarExpertContractUrl(escrowAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Stellar Expert
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {t('dealDetail.escrowPendingDeploy')}
        </p>
      )}

      {indexerEscrow ? (
        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t('dealDetail.fromIndexer')}</p>
          {indexerEscrow.type ? (
            <p className="mt-1 break-words capitalize">{indexerEscrow.type.replace('-', ' ')}</p>
          ) : null}
          {indexerEscrow.balance != null ? (
            <p className="mt-1 break-words">
              {t('dealDetail.balanceLine', { bal: indexerEscrow.balance.toLocaleString() })}
            </p>
          ) : null}
          {indexerEscrow.milestones?.map((m, i) => {
            const amount =
              'amount' in m && m.amount != null ? ` (${m.amount})` : ''
            const released =
              'flags' in m && m.flags && typeof m.flags === 'object' && 'released' in m.flags
                ? Boolean((m.flags as { released?: boolean }).released)
                : false
            return (
              <p
                key={`indexer-milestone-${i}-${m.status ?? ''}`}
                className="mt-0.5 break-words"
              >
                {t('dealDetail.indexerMilestoneLine', {
                  i,
                  status: released ? 'released' : (m.status ?? '—'),
                  amt: amount,
                })}
              </p>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
