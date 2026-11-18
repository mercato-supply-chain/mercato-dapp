import { describe, expect, test } from 'bun:test'
import { Address, Keypair, xdr } from '@stellar/stellar-sdk'
import {
  CONTRIBUTION_EVENT_TYPE,
  eventIndexFromId,
  parseContributionEvent,
  parseRefundEvent,
  parseSettlementEvent,
  selectContributionEvents,
  type RwaRawEvent,
} from '@/lib/rwa/chain'

const INVESTOR = accountAddress(1)
const OTHER_INVESTOR = accountAddress(2)
const POOL = accountAddress(3)

/** Deterministic, valid Stellar addresses (the checksum has to be correct). */
function accountAddress(seed: number): string {
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32, seed)).publicKey()
}

function bytes32(seed: number): Buffer {
  const buffer = Buffer.alloc(32)
  buffer.fill(seed)
  return buffer
}

function addressVal(address: string): xdr.ScVal {
  return new Address(address).toScVal()
}

/**
 * Build a raw contract event with the same XDR the Soroban RPC returns, so the
 * decoder is exercised against real encoded values.
 */
function rawEvent(params: {
  id: string
  txHash: string
  contractId?: string
  topic: xdr.ScVal[]
  value: xdr.ScVal
  inSuccessfulContractCall?: boolean
}): RwaRawEvent {
  return {
    id: params.id,
    txHash: params.txHash,
    contractId: params.contractId ?? POOL,
    ledger: 1234,
    operationIndex: 0,
    inSuccessfulContractCall: params.inSuccessfulContractCall ?? true,
    topic: params.topic,
    value: params.value,
  }
}

function contributionEvent(overrides: {
  assetId?: Buffer
  positionId?: number
  investor?: string
  nonce?: bigint
  ref?: Buffer
  principal?: bigint
  fee?: bigint
  ownership?: bigint
  id?: string
  txHash?: string
} = {}): RwaRawEvent {
  const {
    assetId = bytes32(1),
    positionId = 3,
    investor = INVESTOR,
    nonce = BigInt(7),
    ref = bytes32(2),
    principal = BigInt(1_500_000),
    fee = BigInt(15_000),
    ownership = BigInt(1_500_000),
    id = '1234-0-0',
    txHash = 'a'.repeat(64),
  } = overrides

  return rawEvent({
    id,
    txHash,
    topic: [
      xdr.ScVal.scvSymbol(CONTRIBUTION_EVENT_TYPE),
      xdr.ScVal.scvBytes(assetId),
      xdr.ScVal.scvU32(positionId),
      addressVal(investor),
    ],
    value: xdr.ScVal.scvVec([
      xdr.ScVal.scvU64(nonce),
      xdr.ScVal.scvBytes(ref),
      xdr.ScVal.scvI128(principal),
      xdr.ScVal.scvI128(fee),
      xdr.ScVal.scvI128(ownership),
    ]),
  })
}

describe('parseContributionEvent', () => {
  test('decodes a contribution event from real XDR', () => {
    const event = parseContributionEvent(contributionEvent())

    expect(event).not.toBeNull()
    expect(event?.assetId).toBe(bytes32(1).toString('hex'))
    expect(event?.positionId).toBe(3)
    expect(event?.investorAddress).toBe(INVESTOR)
    expect(event?.nonce).toBe(BigInt(7))
    expect(event?.contributionRef).toBe(bytes32(2).toString('hex'))
    expect(event?.principalUnits).toBe(BigInt(1_500_000))
    expect(event?.fundingFeeUnits).toBe(BigInt(15_000))
    expect(event?.ownershipUnits).toBe(BigInt(1_500_000))
    expect(event?.eventIndex).toBe(0)
  })

  test('ignores events from other contract event types', () => {
    const raw = contributionEvent()
    const positionEvent = rawEvent({
      id: raw.id,
      txHash: raw.txHash,
      topic: [
        xdr.ScVal.scvSymbol('position_v1'),
        xdr.ScVal.scvBytes(bytes32(1)),
        xdr.ScVal.scvU32(3),
        addressVal(INVESTOR),
      ],
      value: raw.value,
    })

    expect(parseContributionEvent(positionEvent)).toBeNull()
  })

  test('ignores an event with too few data fields', () => {
    const raw = contributionEvent()
    const truncated = rawEvent({
      id: raw.id,
      txHash: raw.txHash,
      topic: raw.topic,
      value: xdr.ScVal.scvVec([xdr.ScVal.scvU64(BigInt(1))]),
    })

    expect(parseContributionEvent(truncated)).toBeNull()
  })

  test('ignores an event whose data is not a vec', () => {
    const raw = contributionEvent()
    const notAVec = rawEvent({
      id: raw.id,
      txHash: raw.txHash,
      topic: raw.topic,
      value: xdr.ScVal.scvU32(1),
    })

    expect(parseContributionEvent(notAVec)).toBeNull()
  })

  test('ignores an event with a non 32-byte asset id', () => {
    const raw = contributionEvent()
    const shortAsset = rawEvent({
      id: raw.id,
      txHash: raw.txHash,
      topic: [
        xdr.ScVal.scvSymbol(CONTRIBUTION_EVENT_TYPE),
        xdr.ScVal.scvBytes(Buffer.alloc(16, 1)),
        xdr.ScVal.scvU32(3),
        addressVal(INVESTOR),
      ],
      value: raw.value,
    })

    expect(parseContributionEvent(shortAsset)).toBeNull()
  })
})

describe('parseSettlementEvent', () => {
  test('decodes a settlement event from real XDR', () => {
    const raw = rawEvent({
      id: '99-1-0',
      txHash: 'b'.repeat(64),
      topic: [
        xdr.ScVal.scvSymbol('settle_v1'),
        xdr.ScVal.scvBytes(bytes32(9)),
      ],
      value: xdr.ScVal.scvVec([
        addressVal(INVESTOR),
        xdr.ScVal.scvI128(BigInt(1_000_000)),
        addressVal(OTHER_INVESTOR),
        xdr.ScVal.scvI128(BigInt(10_000)),
        xdr.ScVal.scvU32(2),
      ]),
    })

    const event = parseSettlementEvent(raw)

    expect(event?.assetId).toBe(bytes32(9).toString('hex'))
    expect(event?.supplierAddress).toBe(INVESTOR)
    expect(event?.principalUnits).toBe(BigInt(1_000_000))
    expect(event?.feeRecipientAddress).toBe(OTHER_INVESTOR)
    expect(event?.fundingFeeUnits).toBe(BigInt(10_000))
    expect(event?.feePolicyVersion).toBe(2)
  })

  test('ignores a contribution event', () => {
    expect(parseSettlementEvent(contributionEvent())).toBeNull()
  })
})

describe('parseRefundEvent', () => {
  test('decodes a refund event from real XDR', () => {
    const raw = rawEvent({
      id: '77-2-1',
      txHash: 'c'.repeat(64),
      topic: [
        xdr.ScVal.scvSymbol('refund_v1'),
        xdr.ScVal.scvBytes(bytes32(4)),
        xdr.ScVal.scvU32(11),
        addressVal(INVESTOR),
      ],
      value: xdr.ScVal.scvVec([
        xdr.ScVal.scvI128(BigInt(500_000)),
        xdr.ScVal.scvI128(BigInt(5_000)),
      ]),
    })

    const event = parseRefundEvent(raw)

    expect(event?.assetId).toBe(bytes32(4).toString('hex'))
    expect(event?.positionId).toBe(11)
    expect(event?.investorAddress).toBe(INVESTOR)
    expect(event?.principalUnits).toBe(BigInt(500_000))
    expect(event?.fundingFeeUnits).toBe(BigInt(5_000))
    expect(event?.eventIndex).toBe(1)
  })
})

describe('eventIndexFromId', () => {
  test('reads the event index from the RPC event id', () => {
    expect(eventIndexFromId('1234-5-6', 0)).toBe(6)
    expect(eventIndexFromId('1234-0-0', 0)).toBe(0)
  })

  test('falls back to the positional index for an unexpected id shape', () => {
    expect(eventIndexFromId('unexpected', 4)).toBe(4)
  })
})

describe('selectContributionEvents', () => {
  test('keeps only the contribution events', () => {
    const contribution = contributionEvent()
    const other = rawEvent({
      id: '1234-0-1',
      txHash: contribution.txHash,
      topic: [xdr.ScVal.scvSymbol('position_v1')],
      value: xdr.ScVal.scvVec([]),
    })

    const events = selectContributionEvents([other, contribution])

    expect(events).toHaveLength(1)
    expect(events[0].eventIndex).toBe(0)
  })
})
