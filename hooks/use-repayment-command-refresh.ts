'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Shared post-command refresh: bump local data and revalidate RSC payloads. */
export type AfterRepaymentCommand = () => void | Promise<void>

export function useRepaymentCommandRefresh(
  localRefresh?: AfterRepaymentCommand,
) {
  const router = useRouter()
  const [epoch, setEpoch] = useState(0)

  const refreshAfterCommand = useCallback(async () => {
    setEpoch((n) => n + 1)
    await localRefresh?.()
    router.refresh()
  }, [localRefresh, router])

  return { epoch, refreshAfterCommand }
}
