import {
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToBigInt,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { getDefindexAssetDecimals } from '@/lib/defindex/config'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'
import { rawToDisplayAmount } from '@/lib/defindex/amounts'
import { getStellarNetworkConfig, type StellarNetwork } from '@/lib/stellar/network-config'

export type SacTokenBalanceResult = {
  rawBalance: string
  displayBalance: number
  decimals: number
  assetContract: string
  account: string
}

/** Read SAC token balance via Soroban RPC simulation (`balance` on the asset contract). */
export async function getSacTokenBalance(
  ownerAddress: string,
  assetContract: string,
  network: StellarNetwork,
  decimals = getDefindexAssetDecimals(),
): Promise<SacTokenBalanceResult> {
  if (!isLikelyStellarAccountId(ownerAddress)) {
    throw new Error('Invalid Stellar account.')
  }
  if (!isLikelyStellarContractId(assetContract)) {
    throw new Error('Invalid asset contract address.')
  }

  const { rpcUrl, networkPassphrase } = getStellarNetworkConfig(network)
  const rpcServer = new rpc.Server(rpcUrl)
  const account = await rpcServer.getAccount(ownerAddress)
  const contract = new Contract(assetContract)
  const operation = contract.call('balance', new Address(ownerAddress).toScVal())

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build()

  const simulated = await rpcServer.simulateTransaction(transaction)
  if (rpc.Api.isSimulationError(simulated)) {
    return {
      rawBalance: '0',
      displayBalance: 0,
      decimals,
      assetContract,
      account: ownerAddress,
    }
  }

  const retval = simulated.result?.retval
  const rawBalance = retval ? scValToBigInt(retval).toString() : '0'
  const displayBalance = rawToDisplayAmount(rawBalance, decimals)

  return {
    rawBalance,
    displayBalance,
    decimals,
    assetContract,
    account: ownerAddress,
  }
}
