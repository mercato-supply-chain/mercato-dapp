'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readErrorMessage } from '@/lib/defindex/vault-cache'
import type { VaultMonitorPayload } from '@/lib/defindex/vault-monitor'

const DEFAULT_POLL_MS = 30_000

type UseAdminVaultMonitorOptions = {
  /** Override contract id (e.g. newly deployed vault not yet in env). */
  vaultOverride?: string | null
  pollMs?: number
  enabled?: boolean
}

export function useAdminVaultMonitor(options: UseAdminVaultMonitorOptions = {}) {
  const { vaultOverride = null, pollMs = DEFAULT_POLL_MS, enabled = true } = options
  const [data, setData] = useState<VaultMonitorPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchMonitor = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return
      const silent = opts?.silent ?? false
      if (!silent) setIsRefreshing(true)

      try {
        const params = new URLSearchParams()
        const override = vaultOverride?.trim()
        if (override) params.set('vault', override)
        const qs = params.toString() ? `?${params.toString()}` : ''

        const response = await fetch(`/api/defindex/admin/monitor${qs}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          const message = await readErrorMessage(response)
          if (mountedRef.current) {
            setError(message)
            setData(null)
          }
          return
        }

        const payload = (await response.json()) as VaultMonitorPayload
        if (mountedRef.current) {
          setData(payload)
          setError(null)
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load vault monitor')
          setData(null)
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [enabled, vaultOverride],
  )

  useEffect(() => {
    mountedRef.current = true
    setIsLoading(true)
    void fetchMonitor()

    if (!enabled || pollMs <= 0) {
      return () => {
        mountedRef.current = false
      }
    }

    const interval = window.setInterval(() => {
      void fetchMonitor({ silent: true })
    }, pollMs)

    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
    }
  }, [enabled, fetchMonitor, pollMs])

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh: () => fetchMonitor(),
  }
}
