'use client'

import { useMemo, useState } from 'react'
import { useInitializeEscrow, useSendTransaction, useGetEscrowsFromIndexerBySigner } from '@trustless-work/escrow/hooks'
import type { InitializeMultiReleaseEscrowPayload } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { createClient } from '@/lib/supabase/client'

interface DeployEscrowParams {
  dealId: string
  signerAddress: string
  supplierAddress: string
  productName: string
  description: string
  milestones: Array<{ title: string; amount: number }>
  provider: string | null
}

interface CreateDealParams {
  userId: string | null
  signerAddress: string
  supplierId: string
  productName: string
  description: string
  productQuantity: number
  productUnitPrice: number
  totalAmount: number
  termDays: number
  effectiveAPR: number
  yieldBonusApr: number
  category: string
  supplierName: string
  supplierContact: string | null
  fundingWindowDays: number
  milestones: Array<{ name: string; percentage: string }>
  provider: string | null
}

export function useCreateDealSubmit() {
  const supabase = useMemo(() => createClient(), [])
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const pollar = usePollarSession()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deployAndSignEscrow = async (
    params: DeployEscrowParams
  ): Promise<{ contractId: string | undefined }> => {
    const payload: InitializeMultiReleaseEscrowPayload = {
      signer: params.signerAddress,
      engagementId: params.dealId,
      title: params.productName,
      description: params.description,
      roles: {
        approver: params.signerAddress,
        serviceProvider: params.supplierAddress,
        platformAddress: MERCATO_PLATFORM_ADDRESS,
        releaseSigner: MERCATO_PLATFORM_ADDRESS,
        disputeResolver: MERCATO_PLATFORM_ADDRESS,
      },
      platformFee: 2.5,
      trustline: {
        address: USDC_TRUSTLINE.address,
        symbol: USDC_TRUSTLINE.symbol,
      },
      milestones: params.milestones.map((m) => ({
        description: m.title,
        amount: Math.round(m.amount * 100) / 100,
        receiver: params.supplierAddress,
      })),
    }

    const deployResponse = await deployEscrow(payload, 'multi-release')

    if (deployResponse.status !== 'SUCCESS' || !deployResponse.unsignedTransaction) {
      throw new Error('Failed to create escrow transaction')
    }

    let contractId: string | undefined

    if (params.provider === 'pollar') {
      await pollar.signAndSubmitTx(deployResponse.unsignedTransaction)

      const maxAttempts = 5
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 3000))
        }
        try {
          const escrows = await getEscrowsBySigner({ signer: params.signerAddress })
          const match = escrows.find((e) => e.engagementId === params.dealId)
          if (match?.contractId) {
            contractId = match.contractId
            break
          }
        } catch {
          // Indexer might not have caught up yet — retry
        }
      }
    } else {
      const signedXdr = await signTransaction({
        unsignedTransaction: deployResponse.unsignedTransaction,
        address: params.signerAddress,
      })

      if (!signedXdr) {
        throw new Error('Failed to sign transaction')
      }

      const txResult = await sendTransaction(signedXdr)

      if (txResult.status !== 'SUCCESS') {
        throw new Error(
          'message' in txResult
            ? (txResult as { message: string }).message
            : 'Transaction submission failed'
        )
      }

      const escrowResponse = txResult as {
        contractId?: string
        escrow?: { contractId?: string }
      }
      contractId = escrowResponse.contractId ?? escrowResponse.escrow?.contractId
    }

    return { contractId }
  }

  const submit = async (
    params: CreateDealParams
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!params.userId) return { ok: false, error: 'User not authenticated' }
      if (!params.signerAddress) throw new Error('Wallet not connected')
      if (!MERCATO_PLATFORM_ADDRESS) throw new Error('Platform address not configured')
      if (!USDC_TRUSTLINE.address) throw new Error('USDC trustline not configured')

      const { data: company } = await supabase
        .from('supplier_companies')
        .select('id, address, owner_id')
        .eq('id', params.supplierId)
        .single()

      const supplierAddress = company?.address?.trim()
      if (!supplierAddress) {
        throw new Error('Supplier wallet address not found')
      }

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', company?.owner_id)
        .single()

      const fundingExpiresAt = new Date(
        Date.now() + params.fundingWindowDays * 24 * 60 * 60 * 1000
      ).toISOString()

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          pyme_id: params.userId,
          title: params.productName,
          description: params.description,
          product_name: params.productName,
          product_quantity: params.productQuantity,
          product_unit_price: params.productUnitPrice,
          amount: params.totalAmount,
          term_days: params.termDays,
          interest_rate: params.effectiveAPR,
          yield_bonus_apr: params.yieldBonusApr,
          category: params.category,
          status: 'seeking_funding',
          supplier_id: params.supplierId,
          supplier_name: params.supplierName,
          supplier_email: ownerProfile?.email ?? null,
          supplier_contact: params.supplierContact,
          platform_fee: 2.5,
          funding_window_days: params.fundingWindowDays,
          funding_expires_at: fundingExpiresAt,
          extension_count: 0,
        })
        .select()
        .single()

      if (dealError) throw dealError

      const milestones = params.milestones.map((m) => {
        const pct = Number(m.percentage)
        const amount = (params.totalAmount * pct) / 100
        return {
          deal_id: deal.id,
          title: m.name.trim(),
          description: `${m.name.trim()} — ${m.percentage}% of deal amount`,
          percentage: pct,
          amount,
          status: 'pending' as const,
        }
      })

      const { error: milestonesError } = await supabase
        .from('milestones')
        .insert(milestones)

      if (milestonesError) throw milestonesError

      const { contractId } = await deployAndSignEscrow({
        dealId: deal.id,
        signerAddress: params.signerAddress,
        supplierAddress,
        productName: params.productName,
        description: params.description,
        milestones: milestones.map((m) => ({
          title: m.title,
          amount: Math.round(m.amount * 100) / 100,
        })),
        provider: params.provider,
      })

      if (!contractId) {
        throw new Error('Escrow contract ID was not confirmed')
      }

      const { error: updateError } = await supabase
        .from('deals')
        .update({
          escrow_id: deal.id,
          escrow_contract_address: contractId,
          escrow_status: 'initialized',
        })
        .eq('id', deal.id)

      if (updateError) throw updateError

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('Error creating deal:', err)
      setError(message)
      return { ok: false, error: message }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, error }
}
