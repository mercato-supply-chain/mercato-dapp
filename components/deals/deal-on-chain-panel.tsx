'use client'

import { AlertCircle, ExternalLink } from 'lucide-react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'

type DealOnChainPanelProps = {
  escrowAddress?: string
  investorAddress?: string
  supplierAddress?: string
  indexerEscrow: GetEscrowsFromIndexerResponse | null
  compact?: boolean
}

function truncateContract(id: string, head = 8, tail = 6) {
  if (id.length <= head + tail + 3) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function DealOnChainPanel({
  escrowAddress,
  investorAddress,
  supplierAddress,
  indexerEscrow,
  compact = false,
}: DealOnChainPanelProps) {
  const { t } = useI18n()

  if (!escrowAddress) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.escrowPendingDeploy')}
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('dealDetail.escrowContract')}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
            {compact ? truncateContract(escrowAddress) : escrowAddress}
          </code>
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
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
            <a
              href={`https://stellar.expert/explorer/public/contract/${escrowAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('dealDetail.titleStellarExpert')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      {!compact && investorAddress && (
        <div>
          <p className="mb-1 text-sm font-medium">{t('dealDetail.investorAddress')}</p>
          <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{investorAddress}</code>
        </div>
      )}

      {!compact && supplierAddress && (
        <div>
          <p className="mb-1 text-sm font-medium">{t('dealDetail.supplierWalletAddress')}</p>
          <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{supplierAddress}</code>
        </div>
      )}

      {indexerEscrow && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t('dealDetail.fromIndexer')}</p>
          {indexerEscrow.balance != null && (
            <p className="mt-1">
              {t('dealDetail.balanceLine', { bal: indexerEscrow.balance.toLocaleString() })}
            </p>
          )}
          {indexerEscrow.milestones?.map((m, i) => {
            const amount =
              'amount' in m && m.amount != null ? ` (${m.amount})` : ''
            return (
              <p key={`indexer-milestone-${i}-${m.status ?? ''}`} className="mt-0.5">
                {t('dealDetail.indexerMilestoneLine', {
                  i,
                  status: m.status ?? '—',
                  amt: amount,
                })}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
