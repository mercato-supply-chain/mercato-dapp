import {
  MERCATO_PLATFORM_ADDRESS,
  MERCATO_DISPUTE_RESOLVER_ADDRESS,
} from '@/lib/trustless/config'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { PLATFORM_FEE_PERCENT } from '@/lib/deals/fees'
import {
  TRUSTLESS_WORK_NETWORK,
  type TrustlessConfigSnapshot,
} from '@/lib/trustless/repayment-deployment-draft'

/**
 * Single source of truth for the Trustless Work configuration snapshot used
 * by the deployment draft builder, the stale-data guard and the role builder.
 */
export function buildRepaymentConfigSnapshot(): TrustlessConfigSnapshot {
  return {
    network: TRUSTLESS_WORK_NETWORK,
    platformAddress: MERCATO_PLATFORM_ADDRESS,
    disputeResolverAddress: MERCATO_DISPUTE_RESOLVER_ADDRESS,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    trustline: { address: USDC_TRUSTLINE.address, symbol: USDC_TRUSTLINE.symbol },
  }
}