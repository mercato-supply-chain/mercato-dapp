'use client'

/**
 * Wire Trustless Work hooks, wallet transport, and UI busy state into the
 * repayment command layer. Persistence, indexer retries, and payload
 * construction live in `lib/deals/`.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
  useFundEscrow,
  useApproveMilestone,
  useReleaseFunds,
  useUpdateEscrow,
  useStartDispute,
  useResolveDispute,
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowFromIndexerByContractIds,
  useGetMultipleEscrowBalances,
} from '@trustless-work/escrow/hooks'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import {
  MERCATO_PLATFORM_ADDRESS,
  repaymentEscrowRoles,
} from '@/lib/trustless/config'
import { createClient } from '@/lib/supabase/client'
import { cacheMilestonesFromIndexer } from '@/lib/deals/repayment-escrow-helpers'
import { createRepaymentEscrowCommands } from '@/lib/deals/repayment-escrow-commands'
import { createSupabaseDealRepository } from '@/lib/deals/repayment-escrow-reconcile'
import type {
  AddMilestoneParams,
  DeployRepaymentParams,
  DisputeMilestoneParams,
  FundRepaymentParams,
  IndexerPort,
  ReleaseMilestoneParams,
  ResolveDisputeParams,
  SendTxResult,
  SyncDealFromIndexerOptions,
  TxTransport,
} from '@/lib/deals/repayment-escrow-types'
import {
  DEFAULT_REPAYMENT_RETRY_POLICY,
  defaultWait,
} from '@/lib/deals/repayment-retry'

export function useRepaymentEscrow() {
  const supabase = useMemo(() => createClient(), [])
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { fundEscrow } = useFundEscrow()
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { updateEscrow } = useUpdateEscrow()
  const { startDispute } = useStartDispute()
  const { resolveDispute } = useResolveDispute()
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { getMultipleBalances } = useGetMultipleEscrowBalances()
  const pollar = usePollarSession()
  const [isWorking, setIsWorking] = useState(false)

  const transport: TxTransport = useMemo(
    () => ({
      async signAndSend(unsignedTransaction, address, provider) {
        if (provider === 'pollar') {
          await pollar.signAndSubmitTx(unsignedTransaction)
          return undefined
        }
        const signedXdr = await signTransaction({
          unsignedTransaction,
          address,
        })
        if (!signedXdr) throw new Error('Failed to sign transaction')
        const txResult = await sendTransaction(signedXdr)
        if (txResult.status !== 'SUCCESS') {
          throw new Error(
            'message' in txResult
              ? (txResult as { message: string }).message
              : 'Transaction submission failed',
          )
        }
        return txResult as SendTxResult
      },
    }),
    [pollar, sendTransaction],
  )

  const indexer: IndexerPort = useMemo(
    () => ({
      async getByContractId(contractId) {
        const escrows = await getEscrowByContractIds({
          contractIds: [contractId],
        })
        return escrows?.[0] ?? null
      },
      getBySigner(signer) {
        return getEscrowsBySigner({ signer })
      },
      async getBalance(contractId) {
        try {
          const balances = await getMultipleBalances({
            addresses: [contractId],
          })
          const bal = balances?.[0]?.balance
          if (bal != null && Number.isFinite(Number(bal))) {
            return Number(bal)
          }
        } catch {
          // Indexer balance is fine as fallback
        }
        return null
      },
    }),
    [getEscrowByContractIds, getEscrowsBySigner, getMultipleBalances],
  )

  const deals = useMemo(
    () => createSupabaseDealRepository(supabase),
    [supabase],
  )

  const commands = useMemo(
    () =>
      createRepaymentEscrowCommands({
        builder: {
          initialize: deployEscrow,
          fund: fundEscrow,
          approveMilestone,
          releaseFunds,
          updateEscrow,
          startDispute,
          resolveDispute,
        },
        transport,
        indexer,
        deals,
        config: {
          platformAddress: MERCATO_PLATFORM_ADDRESS,
          trustline: {
            address: USDC_TRUSTLINE.address,
            symbol: USDC_TRUSTLINE.symbol,
          },
          roles: repaymentEscrowRoles,
        },
        wait: defaultWait,
        retry: DEFAULT_REPAYMENT_RETRY_POLICY,
      }),
    [
      approveMilestone,
      deals,
      deployEscrow,
      fundEscrow,
      indexer,
      releaseFunds,
      resolveDispute,
      startDispute,
      transport,
      updateEscrow,
    ],
  )

  const run = useCallback(async <T>(op: () => Promise<T>) => {
    setIsWorking(true)
    try {
      return await op()
    } finally {
      setIsWorking(false)
    }
  }, [])

  const deployRepaymentEscrow = useCallback(
    (params: DeployRepaymentParams) =>
      run(() => commands.deployRepaymentEscrow(params)),
    [commands, run],
  )
  const fundRepaymentEscrow = useCallback(
    (params: FundRepaymentParams) =>
      run(() => commands.fundRepaymentEscrow(params)),
    [commands, run],
  )
  const approveRepaymentMilestone = useCallback(
    (params: ReleaseMilestoneParams) =>
      run(() => commands.approveRepaymentMilestone(params)),
    [commands, run],
  )
  const releaseRepaymentMilestone = useCallback(
    (params: ReleaseMilestoneParams) =>
      run(() => commands.releaseRepaymentMilestone(params)),
    [commands, run],
  )
  const approveAndReleaseMilestone = useCallback(
    (params: ReleaseMilestoneParams) =>
      run(() => commands.approveAndReleaseMilestone(params)),
    [commands, run],
  )
  const addRepaymentMilestone = useCallback(
    (params: AddMilestoneParams) =>
      run(() => commands.addRepaymentMilestone(params)),
    [commands, run],
  )
  const startRepaymentDispute = useCallback(
    (params: DisputeMilestoneParams) =>
      run(() => commands.startRepaymentDispute(params)),
    [commands, run],
  )
  const resolveRepaymentDispute = useCallback(
    (params: ResolveDisputeParams) =>
      run(() => commands.resolveRepaymentDispute(params)),
    [commands, run],
  )
  const syncDealFromIndexer = useCallback(
    (
      dealId: string,
      contractId: string,
      extras?: Record<string, unknown>,
      options?: SyncDealFromIndexerOptions,
    ) => commands.syncDealFromIndexer(dealId, contractId, extras, options),
    [commands],
  )

  return {
    isWorking,
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveRepaymentMilestone,
    releaseRepaymentMilestone,
    approveAndReleaseMilestone,
    addRepaymentMilestone,
    startRepaymentDispute,
    resolveRepaymentDispute,
    syncDealFromIndexer,
    cacheMilestonesFromIndexer,
  }
}
