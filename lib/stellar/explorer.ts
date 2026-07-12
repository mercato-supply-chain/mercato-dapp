import { getAppStellarNetwork } from '@/lib/stellar/network-config'

/** Stellar Expert explorer base for the app network (`public` or `testnet`). */
export function stellarExpertExplorerBase(
  network = getAppStellarNetwork(),
): string {
  const net = network === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${net}`
}

export function stellarExpertTxUrl(hash: string): string {
  return `${stellarExpertExplorerBase()}/tx/${hash}`
}

export function stellarExpertContractUrl(contractId: string): string {
  return `${stellarExpertExplorerBase()}/contract/${contractId}`
}
