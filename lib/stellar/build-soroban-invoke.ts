import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk'
import { getStellarNetworkConfig, type StellarNetwork } from '@/lib/stellar/network-config'

export type SorobanInvokeInput = {
  sourceAddress: string
  contractId: string
  functionName: string
  args: xdr.ScVal[]
  network: StellarNetwork
  rpcUrl?: string
}

/** Build, simulate and assemble one Soroban invoke. Returns the unsigned XDR. */
export async function buildAssembledSorobanInvoke(input: SorobanInvokeInput): Promise<string> {
  const { rpcUrl, networkPassphrase } = getStellarNetworkConfig(input.network)
  const server = new rpc.Server(input.rpcUrl ?? rpcUrl)
  const account = await server.getAccount(input.sourceAddress)
  const operation = new Contract(input.contractId).call(input.functionName, ...input.args)
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build()

  const simulated = await server.simulateTransaction(transaction)
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error)
  }
  return rpc.assembleTransaction(transaction, simulated).build().toXDR()
}

/** Submit a signed envelope. Does not wait for inclusion. */
export async function submitSorobanEnvelope(
  signedXdr: string,
  network: StellarNetwork,
  rpcUrl?: string,
): Promise<{ hash: string; status: string }> {
  const { rpcUrl: defaultRpc, networkPassphrase } = getStellarNetworkConfig(network)
  const server = new rpc.Server(rpcUrl ?? defaultRpc)
  const transaction = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
  const response = await server.sendTransaction(transaction)
  return { hash: response.hash, status: response.status }
}

export function scSymbolMap(entries: ReadonlyArray<readonly [string, xdr.ScVal]>): xdr.ScVal {
  const mapped = entries.map(
    ([key, val]) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(key),
        val,
      }),
  )
  mapped.sort((left, right) => Buffer.compare(left.key().toXDR(), right.key().toXDR()))
  return xdr.ScVal.scvMap(mapped)
}

export function bytes32(hex: string): xdr.ScVal {
  return nativeToScVal(Buffer.from(hex, 'hex'), { type: 'bytes' })
}

export function addressVal(address: string): xdr.ScVal {
  return new Address(address).toScVal()
}
