'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal, Reputation } from '@/lib/types'
import { getReputation } from '@/lib/reputation'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { useWallet } from '@/hooks/use-wallet'

type DealLoadState =
  | { status: 'loading'; dealId: string }
  | { status: 'success'; dealId: string; deal: Deal }
  | { status: 'not-found'; dealId: string }
  | { status: 'error'; dealId: string }

type DealLoadResult =
  | { kind: 'found'; deal: Deal }
  | { kind: 'not-found' }
  | { kind: 'error' }

export function useDealDetail(dealId: string | undefined) {
  const [dealLoadState, setDealLoadState] = useState<DealLoadState | null>(null)
  const [reloadCounter, setReloadCounter] = useState(0)
  const [userType, setUserType] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [indexerEscrow, setIndexerEscrow] = useState<GetEscrowsFromIndexerResponse | null>(null)
  const [pymeReputation, setPymeReputation] = useState<Reputation | null>(null)
  const [supplierReputation, setSupplierReputation] = useState<Reputation | null>(null)
  const [partyReputationsLoading, setPartyReputationsLoading] = useState(false)

  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const supabase = useMemo(() => createClient(), [])
  const activeDealIdRef = useRef<string | undefined>(undefined)
  const requestSequenceRef = useRef(0)
  const lastCommittedSequenceRef = useRef(0)
  const dealRequestSequencesRef = useRef(new WeakMap<Deal, number>())

  const loadDeal = useCallback(async (id: string): Promise<DealLoadResult> => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(
          `
          *,
          milestones(*),
          pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount, address),
          investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name),
          supplier:supplier_companies(company_name, full_name, contact_name, owner_id, address)
        `,
        )
        .eq('id', id)
        .single()
      if (error) {
        const noRows = error.code === 'PGRST116' && /contains 0 rows/i.test(error.details)
        return noRows ? { kind: 'not-found' } : { kind: 'error' }
      }
      if (!data) return { kind: 'not-found' }
      const deal = mapDealFromDb(data as DealRow)
      const assetRowId = (data as DealRow).rwa_asset_row_id
      if (assetRowId) {
        const { data: asset } = await supabase
          .from('rwa_assets')
          .select('asset_id, lifecycle, funded_principal_units, token_decimals')
          .eq('id', assetRowId)
          .maybeSingle()
        if (asset) {
          const decimals = Number(asset.token_decimals ?? 7)
          deal.rwaAssetId = String(asset.asset_id)
          deal.rwaLifecycle = asset.lifecycle as Deal['rwaLifecycle']
          deal.confirmedPrincipal = Number(asset.funded_principal_units) / 10 ** decimals
        }
      }
      return { kind: 'found', deal }
    } catch {
      return { kind: 'error' }
    }
  }, [supabase])

  const fetchDeal = useCallback(async (): Promise<Deal | null> => {
    if (!dealId) return null
    const sequence = ++requestSequenceRef.current
    try {
      const result = await loadDeal(dealId)
      if (result.kind !== 'found') return null
      dealRequestSequencesRef.current.set(result.deal, sequence)
      return result.deal
    } catch {
      return null
    }
  }, [dealId, loadDeal])

  const setDeal = useCallback((next: Deal) => {
    const activeDealId = activeDealIdRef.current
    if (!activeDealId || next.id !== activeDealId) return
    const sequence =
      dealRequestSequencesRef.current.get(next) ?? ++requestSequenceRef.current
    if (sequence < lastCommittedSequenceRef.current) return
    lastCommittedSequenceRef.current = sequence
    setDealLoadState({ status: 'success', dealId: activeDealId, deal: next })
  }, [])

  const retry = useCallback(() => {
    if (!dealId) return
    setDealLoadState({ status: 'loading', dealId })
    setReloadCounter((counter) => counter + 1)
  }, [dealId])

  useEffect(() => {
    const loadUserProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setUserType(null)
        setUserId(null)
        return
      }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()
      setUserType(profile?.user_type ?? null)
    }
    loadUserProfile()
  }, [supabase])

  useEffect(() => {
    activeDealIdRef.current = dealId
    return () => {
      if (activeDealIdRef.current === dealId) activeDealIdRef.current = undefined
    }
  }, [dealId])

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    const sequence = ++requestSequenceRef.current
    void loadDeal(dealId).then((result) => {
      if (
        cancelled ||
        activeDealIdRef.current !== dealId ||
        sequence < lastCommittedSequenceRef.current
      ) {
        return
      }
      if (result.kind === 'found') {
        dealRequestSequencesRef.current.set(result.deal, sequence)
        lastCommittedSequenceRef.current = sequence
        setDealLoadState({ status: 'success', dealId, deal: result.deal })
      } else {
        setDealLoadState({ status: result.kind, dealId })
      }
    })
    return () => {
      cancelled = true
    }
  }, [dealId, loadDeal, reloadCounter])

  const matchingLoadState = dealLoadState?.dealId === dealId ? dealLoadState : null
  const deal = matchingLoadState?.status === 'success' ? matchingLoadState.deal : null
  const isLoading = Boolean(
    dealId && (!matchingLoadState || matchingLoadState.status === 'loading'),
  )
  const loadError = matchingLoadState?.status === 'error'

  useEffect(() => {
    const pymeId = deal?.pymeId
    const supplierOwnerId = deal?.supplierOwnerId
    if (!pymeId && !supplierOwnerId) {
      setPymeReputation(null)
      setSupplierReputation(null)
      setPartyReputationsLoading(false)
      return
    }
    let cancelled = false
    setPartyReputationsLoading(true)
    Promise.all([
      pymeId ? getReputation(supabase, pymeId) : Promise.resolve(null),
      supplierOwnerId ? getReputation(supabase, supplierOwnerId) : Promise.resolve(null),
    ])
      .then(([pyme, supplier]) => {
        if (cancelled) return
        setPymeReputation(pyme)
        setSupplierReputation(supplier)
      })
      .catch(() => {
        if (!cancelled) {
          setPymeReputation(null)
          setSupplierReputation(null)
        }
      })
      .finally(() => {
        if (!cancelled) setPartyReputationsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [deal?.pymeId, deal?.supplierOwnerId, supabase])

  const escrowAddress = deal?.escrowAddress ?? ''
  const getEscrowRef = useRef(getEscrowByContractIds)
  getEscrowRef.current = getEscrowByContractIds
  useEffect(() => {
    if (!escrowAddress) {
      setIndexerEscrow(null)
      return
    }
    let cancelled = false
    getEscrowRef.current({ contractIds: [escrowAddress] })
      .then((escrows) => {
        if (!cancelled && escrows?.length) setIndexerEscrow(escrows[0])
        else if (!cancelled) setIndexerEscrow(null)
      })
      .catch(() => {
        if (!cancelled) setIndexerEscrow(null)
      })
    return () => {
      cancelled = true
    }
  }, [escrowAddress])

  const isSupplier = Boolean(deal?.supplierOwnerId && userId && deal.supplierOwnerId === userId)
  const isPyme = Boolean(deal?.pymeId && userId && deal.pymeId === userId)
  const isAdmin = userType === 'admin'

  return {
    deal,
    setDeal,
    isLoading,
    loadError,
    retry,
    userId,
    userType,
    isSupplier,
    isPyme,
    isAdmin,
    indexerEscrow,
    pymeReputation,
    supplierReputation,
    partyReputationsLoading,
    fetchDeal,
    supabase,
    walletInfo,
    isConnected,
    handleConnect,
  }
}
