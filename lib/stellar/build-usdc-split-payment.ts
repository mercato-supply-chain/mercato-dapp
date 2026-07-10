import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { getAppStellarNetwork, getStellarNetworkConfig } from '@/lib/stellar/network-config'
import { platformFeeAmount } from '@/lib/deals/fees'

/** Circle USDC issuer on Stellar testnet (documented by Trustless Work). */
const TESTNET_USDC_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/** Circle USDC issuer on Stellar public network. */
const MAINNET_USDC_ISSUER =
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

export function getUsdcIssuer(): string {
  const fromEnv = process.env.NEXT_PUBLIC_USDC_ISSUER?.trim()
  if (fromEnv) return fromEnv
  return getAppStellarNetwork() === 'mainnet' ? MAINNET_USDC_ISSUER : TESTNET_USDC_ISSUER
}

export function getUsdcAsset(): Asset {
  return new Asset('USDC', getUsdcIssuer())
}

export interface BuildUsdcSplitPaymentParams {
  sourceAddress: string
  supplierAddress: string
  platformAddress: string
  /** Supplier invoice / principal in USDC. */
  principal: number
}

/**
 * Build an unsigned classic Stellar transaction that pays:
 * - `principal` USDC to the supplier
 * - 1% platform fee USDC to the platform address
 */
export async function buildUsdcSplitPaymentXdr(
  params: BuildUsdcSplitPaymentParams,
): Promise<string> {
  const { sourceAddress, supplierAddress, platformAddress, principal } = params

  if (!sourceAddress?.trim()) throw new Error('Source wallet address is required')
  if (!supplierAddress?.trim()) throw new Error('Supplier wallet address is required')
  if (!platformAddress?.trim()) throw new Error('Platform address is not configured')
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Principal must be a positive amount')
  }

  const fee = platformFeeAmount(principal)
  if (fee <= 0) throw new Error('Platform fee must be positive')

  const network = getAppStellarNetwork()
  const { horizonUrl, networkPassphrase } = getStellarNetworkConfig(network)
  const server = new Horizon.Server(horizonUrl)
  const account = await server.loadAccount(sourceAddress)
  const usdc = getUsdcAsset()

  const principalStr = principal.toFixed(2)
  const feeStr = fee.toFixed(2)

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: supplierAddress,
        asset: usdc,
        amount: principalStr,
      }),
    )
    .addOperation(
      Operation.payment({
        destination: platformAddress,
        asset: usdc,
        amount: feeStr,
      }),
    )
    .setTimeout(180)
    .build()

  return transaction.toXDR()
}
