import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  AlbedoModule,
  FreighterModule,
} from '@creit.tech/stellar-wallets-kit'

const isTestnet =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'

/**
 * Stellar Wallet Kit configuration for signing transactions.
 * Supports Freighter and Albedo wallets.
 * @see https://docs.trustlesswork.com/trustless-work/pt/developer-resources/stellar-wallet-kit-integracao-rapida
 */
export const stellarWalletKit = new StellarWalletsKit({
  network: isTestnet ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC,
  selectedWalletId: FREIGHTER_ID,
  modules: [new FreighterModule(), new AlbedoModule()],
})

export const NETWORK_PASSPHRASE = isTestnet
  ? WalletNetwork.TESTNET
  : WalletNetwork.PUBLIC

interface SignTransactionParams {
  unsignedTransaction: string
  address: string
}

/**
 * Sign a Stellar transaction using the connected wallet.
 * @param unsignedTransaction - XDR string of the unsigned transaction
 * @param address - Wallet address that will sign the transaction
 * @returns The signed XDR string
 */
export const signTransaction = async ({
  unsignedTransaction,
  address,
}: SignTransactionParams): Promise<string> => {
  const { signedTxXdr } = await stellarWalletKit.signTransaction(unsignedTransaction, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  return signedTxXdr
}
