// Same values as `Networks` in @stellar/stellar-sdk. Importing the SDK here would put all of it in
// every client bundle that only needs a network name or explorer link.
const NETWORK_PASSPHRASES = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
} as const

export type StellarNetwork = 'testnet' | 'mainnet'

export function getAppStellarNetwork(): StellarNetwork {
  return process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
}

export function getStellarNetworkConfig(network: StellarNetwork = getAppStellarNetwork()) {
  return {
    horizonUrl:
      network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org',
    rpcUrl:
      network === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.org'
        : 'https://soroban-testnet.stellar.org',
    networkPassphrase: NETWORK_PASSPHRASES[network],
  }
}
