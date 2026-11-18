import { WalletNetwork } from '@creit.tech/stellar-wallets-kit'
import { loadStoredWallet } from '@/lib/mercato-wallet'
import { getStellarWalletKit as getLazyWalletKit } from '@/lib/trustless/lazy-wallet-kit'

const isTestnet =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'

export const NETWORK_PASSPHRASE = isTestnet
  ? WalletNetwork.TESTNET
  : WalletNetwork.PUBLIC

interface SignTransactionParams {
  unsignedTransaction: string
  address: string
}

/**
 * Sign a Stellar transaction using Stellar Wallets Kit (Freighter / Albedo).
 * For Pollar embedded wallets use `usePollarSession().signAndSubmitTx` instead,
 * which signs AND submits in one step via Pollar's infrastructure.
 *
 * The wallet kit SDK is lazily initialized on first call.
 *
 * @param unsignedTransaction - XDR string of the unsigned transaction
 * @param address - Wallet address that will sign the transaction
 * @returns The signed XDR string
 */
export const signTransaction = async ({
  unsignedTransaction,
  address,
}: SignTransactionParams): Promise<string> => {
  const activeWallet = loadStoredWallet()
  if (activeWallet?.provider === 'pollar') {
    throw new Error(
      'Use Pollar signAndSubmitTx for embedded wallet signing — call usePollarSession().signAndSubmitTx(unsignedXdr) instead.',
    )
  }

  const walletKit = await getLazyWalletKit()
  if (!walletKit) {
    throw new Error('Wallet kit is not available (e.g. in server context).')
  }

  const { signedTxXdr } = await walletKit.signTransaction(unsignedTransaction, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  return signedTxXdr
}
