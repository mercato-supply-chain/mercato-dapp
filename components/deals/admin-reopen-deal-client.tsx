'use client'

import { useRouter } from 'next/navigation'
import type { Deal } from '@/lib/types'
import { DealAdminReopenPanel } from '@/components/deals/deal-admin-reopen-panel'

type AdminReopenDealClientProps = {
  deal: Deal
}

export function AdminReopenDealClient({ deal }: AdminReopenDealClientProps) {
  const router = useRouter()

  return (
    <DealAdminReopenPanel
      deal={deal}
      isAdmin
      inline
      onReopened={() => {
        router.push(`/deals/${deal.id}`)
        router.refresh()
      }}
    />
  )
}
