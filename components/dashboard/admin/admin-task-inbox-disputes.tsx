'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { AlertTriangle, ChevronRight, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { isMilestoneDisputed } from '@/lib/admin/milestone-flags'
import type { AdminOverviewEscrowRef } from '@/lib/admin/types'
import { useI18n } from '@/lib/i18n/provider'

type AdminTaskInboxDisputesProps = {
  escrows: AdminOverviewEscrowRef[]
}

/**
 * Dispute state lives only in the Trustless Work indexer, so it is checked
 * live on the client and appended above the derived task list.
 */
type ResolvedEscrows = {
  key: string
  map: Map<string, GetEscrowsFromIndexerResponse>
}

export function AdminTaskInboxDisputes({ escrows }: AdminTaskInboxDisputesProps) {
  const { t } = useI18n()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const getEscrowRef = useRef(getEscrowByContractIds)

  useEffect(() => {
    getEscrowRef.current = getEscrowByContractIds
  }, [getEscrowByContractIds])

  const contractIdsKey = useMemo(
    () => escrows.map((e) => e.contractId).sort().join(','),
    [escrows],
  )

  const [resolved, setResolved] = useState<ResolvedEscrows | null>(null)

  useEffect(() => {
    if (!contractIdsKey) return
    let cancelled = false
    getEscrowRef
      .current({ contractIds: contractIdsKey.split(',').filter(Boolean) })
      .then((result) => {
        if (cancelled) return
        const map = new Map<string, GetEscrowsFromIndexerResponse>()
        for (const escrow of result ?? []) {
          if (escrow.contractId) map.set(escrow.contractId, escrow)
        }
        setResolved({ key: contractIdsKey, map })
      })
      .catch(() => {
        if (!cancelled) setResolved({ key: contractIdsKey, map: new Map() })
      })
    return () => {
      cancelled = true
    }
  }, [contractIdsKey])

  const loading = Boolean(contractIdsKey) && resolved?.key !== contractIdsKey

  const disputed = useMemo(() => {
    if (resolved?.key !== contractIdsKey) return []
    const rows: AdminOverviewEscrowRef[] = []
    for (const ref of escrows) {
      const escrow = resolved.map.get(ref.contractId)
      if (!escrow) continue
      const milestones = Array.isArray(escrow.milestones) ? escrow.milestones : []
      const hasDispute = milestones.some((_, index) =>
        isMilestoneDisputed(escrow, index),
      )
      if (hasDispute) rows.push(ref)
    }
    return rows
  }, [escrows, resolved, contractIdsKey])

  if (escrows.length === 0) return null

  if (loading) {
    return (
      <div className="mb-3 space-y-2" aria-busy>
        <p className="text-xs text-muted-foreground">
          {t('adminOverview.disputesChecking')}
        </p>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (disputed.length === 0) return null

  return (
    <div className="mb-3">
      <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Radio className="h-3 w-3" aria-hidden />
        {t('adminOverview.disputesLive')}
      </p>
      <ul className="divide-y divide-border/70">
        {disputed.map((ref) => (
          <li key={ref.contractId}>
            <Link
              href={`/deals/${ref.dealId}`}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-nowrap"
            >
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-red-300/60 bg-red-500/10 text-[11px] text-red-800 dark:border-red-800/50 dark:text-red-300"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {t('adminOverview.priority.critical')}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t('adminOverview.disputedTitle', { deal: ref.dealTitle })}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ref.dealTitle}
                  {' · '}
                  {t('adminOverview.states.disputed')}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                {t('adminOverview.actions.resolveDispute')}
                <ChevronRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
