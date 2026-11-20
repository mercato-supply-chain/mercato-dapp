import { Keypair, StrKey, Transaction, TransactionBuilder } from '@stellar/stellar-sdk'
import { getStellarNetworkConfig, type StellarNetwork } from '@/lib/stellar/network-config'

/** A server-owned, reviewed transaction. Never populate this from a submit request. */
export type ReviewedTransactionIntent = {
  readonly unsignedXdr: string
  readonly signingWallet: string
  readonly network: StellarNetwork
}

export class TamperedPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TamperedPayloadError'
  }
}

/**
 * Verify a single-wallet Soroban envelope against the exact reviewed transaction.
 * This proves neither registry authorization nor ledger inclusion. The eventual
 * issuance service must establish those independently using #244/#245.
 */
export function validateSignedTransactionIntent(
  signedXdr: string,
  intent: ReviewedTransactionIntent,
): Transaction {
  try {
    if (
      !StrKey.isValidEd25519PublicKey(intent.signingWallet) ||
      (intent.network !== 'testnet' && intent.network !== 'mainnet')
    ) {
      throw new TamperedPayloadError('Invalid signing wallet or network.')
    }
    const { networkPassphrase } = getStellarNetworkConfig(intent.network)
    const reviewed = TransactionBuilder.fromXDR(intent.unsignedXdr, networkPassphrase)
    const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
    if (!(reviewed instanceof Transaction) || !(signed instanceof Transaction)) {
      throw new TamperedPayloadError('Fee-bump envelopes require a separate reviewed intent.')
    }
    if (reviewed.signatures.length !== 0 || signed.source !== intent.signingWallet) {
      throw new TamperedPayloadError('Expected an unsigned intent owned by the signing wallet.')
    }

    // signatureBase covers every argument, operation source, auth tree, fee,
    // resource limit, footprint, memo, sequence and transaction precondition.
    if (!signed.signatureBase().equals(reviewed.signatureBase())) {
      throw new TamperedPayloadError('Transaction differs from the reviewed intent.')
    }
    const operation = signed.operations[0]
    if (
      signed.operations.length !== 1 ||
      operation.type !== 'invokeHostFunction' ||
      operation.func.switch().name !== 'hostFunctionTypeInvokeContract' ||
      (operation.source && operation.source !== intent.signingWallet)
    ) {
      throw new TamperedPayloadError('Expected one Soroban call from the signing wallet.')
    }
    if (operation.auth?.some(entry =>
      entry.credentials().switch().name !== 'sorobanCredentialsSourceAccount',
    )) {
      throw new TamperedPayloadError('Address authorization requires a separately verified signing flow.')
    }

    const now = BigInt(Math.floor(Date.now() / 1000))
    const bounds = signed.timeBounds
    if (
      !bounds || BigInt(bounds.maxTime) === BigInt(0) ||
      now >= BigInt(bounds.maxTime) || now < BigInt(bounds.minTime)
    ) {
      throw new TamperedPayloadError('Transaction is expired, unbounded or not yet valid.')
    }

    const signer = Keypair.fromPublicKey(intent.signingWallet)
    const signature = signed.signatures[0]
    if (
      signed.signatures.length !== 1 ||
      !signature.hint().equals(signer.signatureHint()) ||
      !signer.verify(signed.hash(), signature.signature())
    ) {
      throw new TamperedPayloadError('Expected a valid wallet signature for the intended network.')
    }
    return signed
  } catch (error) {
    if (error instanceof TamperedPayloadError) throw error
    throw new TamperedPayloadError('Invalid transaction envelope or signature.')
  }
}
