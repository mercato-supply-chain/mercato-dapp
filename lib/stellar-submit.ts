/**
 * Submit a signed Stellar transaction (XDR) to the network via Horizon.
 * For use in the browser (e.g. after user signs an off-ramp burn transaction).
 */

import { Horizon, Transaction } from '@stellar/stellar-sdk'
import { NETWORK_PASSPHRASE } from '@/lib/trustless/wallet-kit'
import type { TxState } from '@/lib/types'

const isTestnet = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'
const HORIZON_URL = isTestnet
  ? 'https://horizon-testnet.stellar.org'
  : 'https://horizon.stellar.org'

/**
 * Submit a signed transaction XDR to the Stellar network.
 * @param signedXdr - Base64-encoded signed transaction envelope
 * @returns Horizon submit response with hash and success flag
 */
export async function submitSignedTransaction(signedXdr: string): Promise<{
  hash: string
  successful: boolean
}> {
  const server = new Horizon.Server(HORIZON_URL)
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE)
  const result = await server.submitTransaction(tx)
  return { hash: result.hash, successful: result.successful }
}

export async function executeTransaction(
  signedXdr: string,
  onStateChange: (state: TxState) => void,
): Promise<{ hash: string; successful: boolean }> {
  onStateChange('loading')
  try {
    const result = await submitSignedTransaction(signedXdr)
    onStateChange('success')
    return result
  } catch (err) {
    onStateChange('error')
    throw err
  }
}
