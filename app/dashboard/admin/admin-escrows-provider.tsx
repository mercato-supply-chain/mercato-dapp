'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Rocket, ShieldCheck } from 'lucide-react'
import { PendingApprovals } from './pending-approvals'
import { CreateRepaymentEscrows } from './create-repayment-escrows'
import type {
  CreateEscrowItem,
  PendingApprovalItem,
  ReleaseFallbackItem,
} from '@/lib/admin/types'
import { useI18n } from '@/lib/i18n/provider'

interface AdminEscrowsProviderProps {
  items: PendingApprovalItem[]
  createEscrowItems: CreateEscrowItem[]
  releaseFallbackItems: ReleaseFallbackItem[]
}

/**
 * Fetches escrow data once for all contract IDs (from both sections)
 * and passes to children to avoid duplicate getEscrowByContractIds calls.
 */
export function AdminEscrowsProvider({
  items,
  createEscrowItems,
  releaseFallbackItems,
}: AdminEscrowsProviderProps) {
  const { t } = useI18n()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const getEscrowRef = useRef(getEscrowByContractIds)
  getEscrowRef.current = getEscrowByContractIds

  const contractIds = useMemo(
    () =>
      [
        ...new Set(
          [
            ...items.map((i) => i.escrowContractAddress),
            ...releaseFallbackItems.map((i) => i.escrowContractAddress),
          ].filter(Boolean),
        ),
      ] as string[],
    [items, releaseFallbackItems],
  )

  const contractIdsKey = useMemo(
    () => (contractIds.length ? contractIds.slice().sort().join(',') : ''),
    [contractIds],
  )

  const [escrowsByContractId, setEscrowsByContractId] = useState<
    Map<string, GetEscrowsFromIndexerResponse>
  >(new Map())

  useEffect(() => {
    if (!contractIdsKey) {
      setEscrowsByContractId(new Map())
      return
    }
    let cancelled = false
    const ids = contractIdsKey.split(',').filter(Boolean)
    getEscrowRef
      .current({ contractIds: ids })
      .then((escrows) => {
        if (cancelled || !escrows) return
        const map = new Map<string, GetEscrowsFromIndexerResponse>()
        for (const e of escrows) {
          if (e.contractId) map.set(e.contractId, e)
        }
        setEscrowsByContractId(map)
      })
      .catch(() => setEscrowsByContractId(new Map()))
    return () => {
      cancelled = true
    }
  }, [contractIdsKey])

  return (
    <div className="space-y-6">
      {createEscrowItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" aria-hidden />
              {t('adminCreateEscrow.cardTitle')}
            </CardTitle>
            <CardDescription>{t('adminCreateEscrow.cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateRepaymentEscrows items={createEscrowItems} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {t('adminEscrows.pendingCardTitle')}
          </CardTitle>
          <CardDescription>{t('adminEscrows.pendingCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PendingApprovals items={items} escrowsByContractId={escrowsByContractId} />
        </CardContent>
      </Card>
    </div>
  )
}
