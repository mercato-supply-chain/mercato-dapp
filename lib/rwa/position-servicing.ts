import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PAYOUT_FEE_POLICY,
  buildPositionPayoutSchedule,
  grossAtomicForNet,
  type PositionPayoutSchedule,
} from '@/lib/trustless/repayment-position-payout'
import { allocatePositionNets } from '@/lib/rwa/bindings'
import { RWA_ERROR_CODES, RwaError } from '@/lib/rwa/errors'

export type ServicedPosition = {
  id: string
  wallet: string
  principalAtomic: bigint
}

/**
 * One tranche per investor. Interest dust lands on the last position.
 * Gross amounts are the exact escrow funding required after the release fees.
 */
export function buildServicingSchedule(input: {
  assetId: string
  assetDecimals: number
  interestNumerator: bigint
  interestDenominator: bigint
  positions: readonly ServicedPosition[]
}): PositionPayoutSchedule {
  const ordered = [...input.positions].sort((left, right) => left.id.localeCompare(right.id))
  const nets = allocatePositionNets(
    ordered.map((position) => position.principalAtomic),
    input.interestNumerator,
    input.interestDenominator,
  )
  const combinedFeeBps = DEFAULT_PAYOUT_FEE_POLICY.platformFeeBps + DEFAULT_PAYOUT_FEE_POLICY.twFeeBps
  const grosses = nets.map((net) => grossAtomicForNet(net, combinedFeeBps))
  const totalNet = nets.reduce((sum, net) => sum + net, BigInt(0))
  const totalGross = grosses.reduce((sum, gross) => sum + gross, BigInt(0))

  return buildPositionPayoutSchedule({
    assetId: input.assetId,
    assetDecimals: input.assetDecimals,
    feePolicy: DEFAULT_PAYOUT_FEE_POLICY,
    totalNetAtomic: totalNet,
    totalGrossAtomic: totalGross,
    positions: ordered.map((position, index) => ({
      assetId: input.assetId,
      positionId: position.id,
      receiver: position.wallet,
      fundingWallet: position.wallet,
      netEntitlementAtomic: nets[index],
      grossObligationAtomic: grosses[index],
    })),
    tranches: ordered.map((position, index) => ({
      assetId: input.assetId,
      positionId: position.id,
      trancheIndex: 0,
      netAtomic: nets[index],
      grossAtomic: grosses[index],
      receiver: position.wallet,
      description: `Investor repayment ${position.id.slice(0, 8)}`,
    })),
  })
}

export async function loadDealServicingSchedule(
  supabase: SupabaseClient,
  dealId: string,
): Promise<PositionPayoutSchedule | null> {
  const { data: asset, error } = await supabase
    .from('rwa_assets')
    .select('id, asset_id, token_decimals, credit_asset_id, lifecycle')
    .eq('deal_id', dealId)
    .maybeSingle()
  if (error) throw error
  if (!asset?.credit_asset_id) return null
  if (asset.lifecycle !== 'settled' && asset.lifecycle !== 'ready_to_settle') {
    throw new RwaError(
      RWA_ERROR_CODES.TARGET_NOT_REACHED,
      'Supplier settlement must complete before repayment is scheduled',
    )
  }

  const { data: credit, error: creditError } = await supabase
    .from('rwa_credit_assets')
    .select('return_numerator, return_denominator, asset_decimals')
    .eq('id', asset.credit_asset_id)
    .maybeSingle()
  if (creditError) throw creditError
  if (!credit) return null

  const { data: positions, error: positionError } = await supabase
    .from('rwa_investor_positions')
    .select('id, investor_wallet, confirmed_principal_atomic, state')
    .eq('credit_asset_id', asset.credit_asset_id)
    .neq('state', 'cancelled')
  if (positionError) throw positionError
  if (!positions || positions.length === 0) return null

  return buildServicingSchedule({
    assetId: String(asset.asset_id),
    assetDecimals: Number(credit.asset_decimals ?? asset.token_decimals ?? 7),
    interestNumerator: BigInt(credit.return_numerator),
    interestDenominator: BigInt(credit.return_denominator),
    positions: positions.map((position) => ({
      id: String(position.id),
      wallet: String(position.investor_wallet),
      principalAtomic: BigInt(position.confirmed_principal_atomic),
    })),
  })
}

export async function redeemPosition(
  supabase: SupabaseClient,
  input: {
    positionId: string
    amountAtomic: string
    txHash: string
    operationId: string
    network: string
    registryContract: string
    ledger: number
  },
): Promise<string> {
  const { data, error } = await supabase.rpc('rwa_redeem_position', {
    p_position_id: input.positionId,
    p_amount_atomic: input.amountAtomic,
    p_network: input.network,
    p_registry_contract: input.registryContract,
    p_tx_hash: input.txHash.toLowerCase(),
    p_operation_or_event_id: input.operationId,
    p_ledger_seq: input.ledger,
  })
  if (error) throw new RwaError(RWA_ERROR_CODES.INTERNAL, error.message)
  return String(data)
}
