'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal, Reputation } from '@/lib/types'
import { getReputation } from '@/lib/reputation'
import { useGetEscrowFromIndexerByContractIds } from '@trustless-work/escrow/hooks'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { useWallet } from '@/hooks/use-wallet'

export function useDealDetail(dealId: string | undefined) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userType, setUserType] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [indexerEscrow, setIndexerEscrow] = useState<GetEscrowsFromIndexerResponse | null>(null)
  const [pymeReputation, setPymeReputation] = useState<Reputation | null>(null)
  const [supplierReputation, setSupplierReputation] = useState<Reputation | null>(null)
  const [partyReputationsLoading, setPartyReputationsLoading] = useState(false)

  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const supabase = useMemo(() => createClient(), [])

  const fetchDeal = useCallback(async () => {
    if (!dealId) return null
    const { data, error } = await supabase
      .from('deals')
      .select(
        `
        *,
        milestones(*),
        pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount, address),
        investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name, address),
        supplier:supplier_companies(company_name, full_name, contact_name, owner_id, address)
      `,
      )
      .eq('id', dealId)
      .single()
    if (error || !data) return null
    return mapDealFromDb(data as DealRow)
  }, [dealId, supabase])

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
    if (!dealId) {
      setIsLoading(false)
      return
    }
    fetchDeal().then((d) => {
      setDeal(d)
      setIsLoading(false)
    })
  }, [dealId, fetchDeal])

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
