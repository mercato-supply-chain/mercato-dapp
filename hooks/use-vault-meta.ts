'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hasClientVaultConfigured,
  isRateLimitMessage,
  vaultMetaRequest,
} from '@/lib/defindex/vault-cache'
import type { VaultMonitorAssetRow } from '@/lib/defindex/vault-monitor'

export type MercatoVaultMeta = {
  vaultAddress: string
  network: string
  name: string
  symbol: string
  apy: number
  feesBps: { vaultFee: number; defindexFee: number }
  assets?: Array<{ address: string; name?: string; symbol?: string; strategies?: unknown[] }>
  totals?: {
    tvlDisplay: number
    idleDisplay: number
    investedDisplay: number
    idlePercent: number
  }
  assetRows?: VaultMonitorAssetRow[]
  explorerContractUrl?: string
}

export function useVaultMeta() {
  const [vaultMeta, setVaultMeta] = useState<MercatoVaultMeta | null>(null)
  const [vaultInfoError, setVaultInfoError] = useState<string | null>(null)
  const vaultMetaRef = useRef<MercatoVaultMeta | null>(null)
  vaultMetaRef.current = vaultMeta

  const fetchVaultMeta = useCallback(async (): Promise<MercatoVaultMeta | null> => {
    if (!hasClientVaultConfigured()) {
      setVaultInfoError(null)
      setVaultMeta(null)
      return null
    }
    try {
      const data = await vaultMetaRequest.fetch()
      setVaultInfoError(null)
      setVaultMeta(data)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load vault metadata.'
      if (!isRateLimitMessage(message) || !vaultMetaRef.current) {
        setVaultInfoError(message)
      }
      return vaultMetaRef.current
    }
  }, [])

  const fetchVaultMetaRef = useRef(fetchVaultMeta)
  fetchVaultMetaRef.current = fetchVaultMeta

  useEffect(() => {
    if (!hasClientVaultConfigured()) return
    void fetchVaultMetaRef.current()
  }, [])

  return {
    vaultMeta,
    vaultInfoError,
    vaultMetaRef,
    fetchVaultMeta,
    fetchVaultMetaRef,
    setVaultMeta,
    setVaultInfoError,
  }
}
