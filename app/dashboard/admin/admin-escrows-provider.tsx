'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, FileCheck } from 'lucide-react'
import { PendingApprovals } from './pending-approvals'
import { ReleaseFundsFallback } from './release-funds-fallback'
import type { PendingApprovalItem, ReleaseFallbackItem } from './page'

interface AdminEscrowsProviderProps {
  items: PendingApprovalItem[]
  releaseFallbackItems: ReleaseFallbackItem[]
}

/**
 * Fetches escrow data once for all contract IDs (from both sections)
 * and passes to children to avoid duplicate getEscrowByContractIds calls.
 */
export function AdminEscrowsProvider({ items, releaseFallbackItems }: AdminEscrowsProviderProps) {
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const getEscrowRef = useRef(getEscrowByContractIds)
  getEscrowRef.current = getEscrowByContractIds

  const contractIds = useMemo(
    () =>
      [
        ...new Set([
          ...items.map((i) => i.escrowContractAddress),
          ...releaseFallbackItems.map((i) => i.escrowContractAddress),
        ].filter(Boolean)),
      ] as string[],
    [items, releaseFallbackItems]
  )

  const contractIdsKey = useMemo(
    () => (contractIds.length ? contractIds.slice().sort().join(',') : ''),
    [contractIds]
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
    getEscrowRef.current({ contractIds: ids })
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            Pending approvals
          </CardTitle>
          <CardDescription>
            First 50%: supplier accepted — use Approve then Release. Second 50%: PyME confirmed delivery — use Release
            only (approval already done by PyME).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PendingApprovals items={items} escrowsByContractId={escrowsByContractId} />
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" aria-hidden />
            Release funds (fallback)
          </CardTitle>
          <CardDescription>
            Milestones marked completed in DB. Use Approve if not yet approved on-chain; use Release to send funds.
            PyME-confirmed milestones are already approved — use Release only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReleaseFundsFallback items={releaseFallbackItems} escrowsByContractId={escrowsByContractId} />
        </CardContent>
      </Card>
    </>
  )
}
