import { describe, expect, test } from 'bun:test'
import {
  Account, Address, Asset, Keypair, Memo, Networks, Operation, SorobanDataBuilder,
  StrKey, Transaction, TransactionBuilder, nativeToScVal, xdr,
} from '@stellar/stellar-sdk'
import {
  TamperedPayloadError, validateSignedTransactionIntent, type ReviewedTransactionIntent,
} from '@/lib/rwa/transaction-intents'
import type { StellarNetwork } from '@/lib/stellar/network-config'

// Disposable local fixtures only: no deployed contracts, funded accounts or RPC.
const wallet = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1))
const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2))
const contractId = StrKey.encodeContract(Buffer.alloc(32, 3))
const now = Math.floor(Date.now() / 1000)

type Changes = {
  principal?: bigint; receiver?: string; controller?: string; assetByte?: number;
  contractId?: string; method?: string; source?: string; operationSource?: string;
  fee?: string; sequence?: string; memo?: string; minTime?: number; maxTime?: number;
  instructions?: number; resourceFee?: string; footprint?: number; authMethod?: string;
  addressAuth?: boolean; extraOperation?: boolean; classic?: boolean;
}

function prepare(changes: Changes = {}, network: StellarNetwork = 'testnet'): Transaction {
  const invoke = new xdr.InvokeContractArgs({
    contractAddress: new Address(changes.contractId ?? contractId).toScAddress(),
    functionName: changes.method ?? 'register_asset',
    args: [
      xdr.ScVal.scvBytes(Buffer.alloc(32, changes.assetByte ?? 4)),
      nativeToScVal({
        principal: changes.principal ?? BigInt(10000000),
        receiver: new Address(changes.receiver ?? wallet.publicKey()),
        controller: new Address(changes.controller ?? wallet.publicKey()),
      }),
    ],
  })
  const credentials = changes.addressAuth
    ? xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
        address: new Address(wallet.publicKey()).toScAddress(),
        nonce: xdr.Int64.fromString('1'), signatureExpirationLedger: 10,
        signature: xdr.ScVal.scvVoid(),
      }))
    : xdr.SorobanCredentials.sorobanCredentialsSourceAccount()
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials,
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: invoke.contractAddress(), functionName: changes.authMethod ?? 'register_asset',
          args: invoke.args(),
        }),
      ),
      subInvocations: [],
    }),
  })
  const operation = changes.classic
    ? Operation.payment({ destination: other.publicKey(), asset: Asset.native(), amount: '1' })
    : Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(invoke), auth: [auth],
        source: changes.operationSource,
      })
  const builder = new TransactionBuilder(
    new Account(changes.source ?? wallet.publicKey(), changes.sequence ?? '100'),
    { fee: changes.fee ?? '1000', networkPassphrase: network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC },
  ).addOperation(operation).setTimebounds(changes.minTime ?? 0, changes.maxTime ?? now + 300)
  if (!changes.classic) {
    builder.setSorobanData(new SorobanDataBuilder()
      .setResources(changes.instructions ?? 1000, 100, 100)
      .setResourceFee(changes.resourceFee ?? '500')
      .setReadOnly([xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({
        hash: Buffer.alloc(32, changes.footprint ?? 1),
      }))]).build())
  }
  if (changes.memo) builder.addMemo(Memo.text(changes.memo))
  if (changes.extraOperation) builder.addOperation(operation)
  return builder.build()
}

function intent(transaction: Transaction, network: StellarNetwork = 'testnet'): ReviewedTransactionIntent {
  return { unsignedXdr: transaction.toXDR(), signingWallet: wallet.publicKey(), network }
}

function sign(transaction: Transaction, signer = wallet): string {
  transaction.sign(signer)
  return transaction.toXDR()
}

describe('reviewed signed transaction intents', () => {
  for (const network of ['testnet', 'mainnet'] as const) {
    test(`accepts an unchanged envelope signed for ${network}`, () => {
      const prepared = prepare({}, network)
      const expected = intent(prepared, network)
      const verified = validateSignedTransactionIntent(sign(prepared), expected)
      expect(verified.hash().toString('hex')).toBe(prepared.hash().toString('hex'))
    })
  }

  const tampering: [string, Changes][] = [
    ['principal', { principal: BigInt(99999999) }],
    ['receiver', { receiver: other.publicKey() }],
    ['controller', { controller: other.publicKey() }],
    ['asset ID', { assetByte: 5 }],
    ['contract', { contractId: StrKey.encodeContract(Buffer.alloc(32, 6)) }],
    ['method', { method: 'transfer' }],
    ['source', { source: other.publicKey() }],
    ['operation source', { operationSource: other.publicKey() }],
    ['fee', { fee: '5000' }],
    ['sequence', { sequence: '101' }],
    ['memo', { memo: 'altered' }],
    ['time bounds', { maxTime: now + 600 }],
    ['resource limits', { instructions: 100000 }],
    ['resource fee', { resourceFee: '900' }],
    ['footprint', { footprint: 2 }],
    ['authorization', { authMethod: 'transfer' }],
    ['operation count', { extraOperation: true }],
  ]
  for (const [field, changes] of tampering) {
    test(`rejects modified ${field}, even with a valid wallet signature`, () => {
      expect(() => validateSignedTransactionIntent(sign(prepare(changes)), intent(prepare())))
        .toThrow(TamperedPayloadError)
    })
  }

  test('rejects the same envelope signed for another network', () => {
    expect(() => validateSignedTransactionIntent(sign(prepare({}, 'mainnet')), intent(prepare())))
      .toThrow(TamperedPayloadError)
  })

  test('rejects an unsigned envelope', () => {
    const prepared = prepare()
    expect(() => validateSignedTransactionIntent(prepared.toXDR(), intent(prepared)))
      .toThrow(TamperedPayloadError)
  })

  test('rejects a different wallet signature', () => {
    expect(() => validateSignedTransactionIntent(sign(prepare(), other), intent(prepare())))
      .toThrow(TamperedPayloadError)
  })

  test('rejects a changed decorated signature hint', () => {
    const prepared = prepare()
    const expected = intent(prepared)
    prepared.sign(wallet)
    prepared.signatures[0] = new xdr.DecoratedSignature({
      hint: Buffer.alloc(4), signature: prepared.signatures[0].signature(),
    })
    expect(() => validateSignedTransactionIntent(prepared.toXDR(), expected))
      .toThrow(TamperedPayloadError)
  })

  for (const [label, changes] of [
    ['expired', { maxTime: now - 10 }],
    ['unbounded', { maxTime: 0 }],
    ['not yet valid', { minTime: now + 100 }],
    ['classic operation', { classic: true }],
    ['address authorization', { addressAuth: true }],
    ['multiple operations', { extraOperation: true }],
    ['different operation signer', { operationSource: other.publicKey() }],
  ] as [string, Changes][]) {
    test(`rejects an otherwise matching ${label} intent`, () => {
      const prepared = prepare(changes)
      const expected = intent(prepared)
      expect(() => validateSignedTransactionIntent(sign(prepared), expected))
        .toThrow(TamperedPayloadError)
    })
  }

  test('rejects a fee-bump wrapper', () => {
    const prepared = prepare()
    const expected = intent(prepared)
    prepared.sign(wallet)
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(other, '1000', prepared, Networks.TESTNET)
    feeBump.sign(other)
    expect(() => validateSignedTransactionIntent(feeBump.toXDR(), expected)).toThrow(TamperedPayloadError)
  })

  test('rejects malformed XDR', () => {
    expect(() => validateSignedTransactionIntent('not-xdr', intent(prepare()))).toThrow(TamperedPayloadError)
  })

  test('rejects an unknown intent network instead of using testnet by default', () => {
    const expected = { ...intent(prepare()), network: 'unknown' as StellarNetwork }
    expect(() => validateSignedTransactionIntent(sign(prepare()), expected)).toThrow(TamperedPayloadError)
  })

  test('rejects an already signed prepared intent', () => {
    const transaction = prepare()
    transaction.sign(wallet)
    expect(() => validateSignedTransactionIntent(transaction.toXDR(), intent(transaction)))
      .toThrow(TamperedPayloadError)
  })
})
