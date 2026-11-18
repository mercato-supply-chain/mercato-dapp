/**
 * Chain access for RWA contributions.
 *
 * The chain is the final authority: a contribution only counts as confirmed
 * when the funding contract actually emitted the expected event for a
 * successful transaction. This module reads the chain; it never trusts a
 * client-supplied claim.
 *
 * The reader is an interface so the verification logic can be exercised
 * against a deterministic fake in tests, and so the Soroban RPC transport can
 * be swapped without touching the rules.
 */

import { Address, rpc, xdr } from '@stellar/stellar-sdk'
import type { RwaConfig } from '@/lib/rwa/config'

/** The event type symbol emitted by `ContributionEvent` in the funding contract. */
export const CONTRIBUTION_EVENT_TYPE = 'contrib_v1'
/** The event type symbol emitted by `SettlementEvent` in the funding contract. */
export const SETTLEMENT_EVENT_TYPE = 'settle_v1'
/** The event type symbol emitted by `RefundEvent` in the funding contract. */
export const REFUND_EVENT_TYPE = 'refund_v1'

/** A raw contract event as returned by the Soroban RPC `getEvents` method. */
export type RwaRawEvent = {
  id: string
  txHash: string
  contractId: string
  ledger: number
  operationIndex: number
  inSuccessfulContractCall: boolean
  topic: xdr.ScVal[]
  value: xdr.ScVal
}

/** A decoded `contrib_v1` event. */
export type RwaContributionEvent = {
  /** RPC event id (`<ledger>-<txIndex>-<eventIndex>`). Unique per event. */
  eventId: string
  /** Event index within the transaction, used for receipt de-duplication. */
  eventIndex: number
  txHash: string
  contractId: string
  ledger: number
  /** Registry asset id, 32-byte lowercase hex. */
  assetId: string
  positionId: number
  investorAddress: string
  nonce: bigint
  /** Contribution reference, 32-byte lowercase hex. */
  contributionRef: string
  principalUnits: bigint
  fundingFeeUnits: bigint
  ownershipUnits: bigint
}

export type RwaChainTransaction = {
  successful: boolean
  ledger: number
}

export type RwaChainReader = {
  /** Transaction outcome, or null when the network does not know the hash. */
  getTransaction(txHash: string): Promise<RwaChainTransaction | null>
  /** Contract events emitted by `contractId` in `txHash`. */
  getContractEvents(contractId: string, txHash: string): Promise<RwaRawEvent[]>
  /** Network passphrase the RPC is connected to, used to pin the network. */
  getNetworkPassphrase(): Promise<string | null>
}

function hexFromBytes(bytes: Buffer): string {
  return Buffer.from(bytes).toString('hex')
}

/** The SDK exposes the active union arm through `switch().name`. */
function isScValType(value: xdr.ScVal, type: string): boolean {
  return value.switch().name === type
}

function readBytes32(value: xdr.ScVal): string | null {
  if (!isScValType(value, 'scvBytes')) return null
  const bytes = value.bytes()
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'base64')
  if (buffer.length !== 32) return null
  return hexFromBytes(buffer)
}

function readAddress(value: xdr.ScVal): string | null {
  if (!isScValType(value, 'scvAddress')) return null
  try {
    return Address.fromScAddress(value.address()).toString()
  } catch {
    return null
  }
}

function readU32(value: xdr.ScVal): number | null {
  if (!isScValType(value, 'scvU32')) return null
  const raw = value.u32()
  return Number.isSafeInteger(raw) ? raw : null
}

function readU64(value: xdr.ScVal): bigint | null {
  if (!isScValType(value, 'scvU64')) return null
  return BigInt(value.u64().toString())
}

function readI128(value: xdr.ScVal): bigint | null {
  if (!isScValType(value, 'scvI128')) return null
  return BigInt(value.i128().toString())
}

function readSymbol(value: xdr.ScVal): string | null {
  if (!isScValType(value, 'scvSymbol')) return null
  return value.sym().toString()
}

/**
 * Derive the event index within the transaction from the RPC event id.
 *
 * The id has the shape `<ledger>-<txIndex>-<eventIndex>`. When the id does not
 * follow that shape the caller's positional index is used instead, which is
 * still stable for a given (contract, transaction) query.
 */
export function eventIndexFromId(eventId: string, fallbackIndex: number): number {
  const parts = eventId.split('-')
  if (parts.length === 3) {
    const parsed = Number(parts[2])
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed
  }
  return fallbackIndex
}

/**
 * Locate the event type symbol among the topics.
 *
 * The funding contract declares its event type as a leading topic, so the
 * structural fields follow it. Returns the index of the symbol, or -1.
 */
function findEventTypeIndex(topics: xdr.ScVal[], eventType: string): number {
  return topics.findIndex((topic) => readSymbol(topic) === eventType)
}

/** Data fields of a contract event. Multiple `#[data]` fields arrive as a vec. */
function readEventData(value: xdr.ScVal): xdr.ScVal[] {
  if (!isScValType(value, 'scvVec')) return []
  return value.vec() ?? []
}

/**
 * Decode a `contrib_v1` contract event.
 *
 * The funding contract emits:
 *   topics: ["contrib_v1", asset_id, position_id, investor]
 *   data:   [nonce, reference, principal_units, funding_fee_units, ownership_units]
 *
 * Returns null when the event is not a contribution event or is malformed, so
 * unrelated events from the same contract are simply skipped.
 */
export function parseContributionEvent(
  raw: RwaRawEvent,
  fallbackIndex = 0,
): RwaContributionEvent | null {
  const topics = raw.topic ?? []
  if (topics.length < 4) return null

  const typeIndex = findEventTypeIndex(topics, CONTRIBUTION_EVENT_TYPE)
  if (typeIndex === -1) return null

  const assetId = readBytes32(topics[typeIndex + 1] ?? (null as never))
  const positionId = readU32(topics[typeIndex + 2] ?? (null as never))
  const investorAddress = readAddress(topics[typeIndex + 3] ?? (null as never))
  if (!assetId || positionId === null || !investorAddress) return null

  const data = readEventData(raw.value)
  if (data.length < 5) return null

  const nonce = readU64(data[0])
  const contributionRef = readBytes32(data[1])
  const principalUnits = readI128(data[2])
  const fundingFeeUnits = readI128(data[3])
  const ownershipUnits = readI128(data[4])
  if (
    nonce === null ||
    !contributionRef ||
    principalUnits === null ||
    fundingFeeUnits === null ||
    ownershipUnits === null
  ) {
    return null
  }

  return {
    eventId: raw.id,
    eventIndex: eventIndexFromId(raw.id, fallbackIndex),
    txHash: raw.txHash,
    contractId: raw.contractId,
    ledger: raw.ledger,
    assetId,
    positionId,
    investorAddress,
    nonce,
    contributionRef,
    principalUnits,
    fundingFeeUnits,
    ownershipUnits,
  }
}

/** A decoded `settle_v1` event. */
export type RwaSettlementEvent = {
  eventId: string
  eventIndex: number
  txHash: string
  contractId: string
  ledger: number
  assetId: string
  supplierAddress: string
  principalUnits: bigint
  feeRecipientAddress: string
  fundingFeeUnits: bigint
  feePolicyVersion: number
}

/**
 * Decode a `settle_v1` contract event.
 *
 *   topics: ["settle_v1", asset_id]
 *   data:   [supplier, principal_units, fee_recipient, funding_fee_units, fee_policy_version]
 */
export function parseSettlementEvent(
  raw: RwaRawEvent,
  fallbackIndex = 0,
): RwaSettlementEvent | null {
  const topics = raw.topic ?? []
  if (topics.length < 2) return null

  const typeIndex = findEventTypeIndex(topics, SETTLEMENT_EVENT_TYPE)
  if (typeIndex === -1) return null

  const assetId = readBytes32(topics[typeIndex + 1] ?? (null as never))
  if (!assetId) return null

  const data = readEventData(raw.value)
  if (data.length < 5) return null

  const supplierAddress = readAddress(data[0])
  const principalUnits = readI128(data[1])
  const feeRecipientAddress = readAddress(data[2])
  const fundingFeeUnits = readI128(data[3])
  const feePolicyVersion = readU32(data[4])
  if (
    !supplierAddress ||
    principalUnits === null ||
    !feeRecipientAddress ||
    fundingFeeUnits === null ||
    feePolicyVersion === null
  ) {
    return null
  }

  return {
    eventId: raw.id,
    eventIndex: eventIndexFromId(raw.id, fallbackIndex),
    txHash: raw.txHash,
    contractId: raw.contractId,
    ledger: raw.ledger,
    assetId,
    supplierAddress,
    principalUnits,
    feeRecipientAddress,
    fundingFeeUnits,
    feePolicyVersion,
  }
}

/** A decoded `refund_v1` event. */
export type RwaRefundEvent = {
  eventId: string
  eventIndex: number
  txHash: string
  contractId: string
  ledger: number
  assetId: string
  positionId: number
  investorAddress: string
  principalUnits: bigint
  fundingFeeUnits: bigint
}

/**
 * Decode a `refund_v1` contract event.
 *
 *   topics: ["refund_v1", asset_id, position_id, investor]
 *   data:   [principal_units, funding_fee_units]
 */
export function parseRefundEvent(
  raw: RwaRawEvent,
  fallbackIndex = 0,
): RwaRefundEvent | null {
  const topics = raw.topic ?? []
  if (topics.length < 4) return null

  const typeIndex = findEventTypeIndex(topics, REFUND_EVENT_TYPE)
  if (typeIndex === -1) return null

  const assetId = readBytes32(topics[typeIndex + 1] ?? (null as never))
  const positionId = readU32(topics[typeIndex + 2] ?? (null as never))
  const investorAddress = readAddress(topics[typeIndex + 3] ?? (null as never))
  if (!assetId || positionId === null || !investorAddress) return null

  const data = readEventData(raw.value)
  if (data.length < 2) return null

  const principalUnits = readI128(data[0])
  const fundingFeeUnits = readI128(data[1])
  if (principalUnits === null || fundingFeeUnits === null) return null

  return {
    eventId: raw.id,
    eventIndex: eventIndexFromId(raw.id, fallbackIndex),
    txHash: raw.txHash,
    contractId: raw.contractId,
    ledger: raw.ledger,
    assetId,
    positionId,
    investorAddress,
    principalUnits,
    fundingFeeUnits,
  }
}

/** Read the contribution events emitted by a transaction. */
export function selectContributionEvents(
  rawEvents: RwaRawEvent[],
): RwaContributionEvent[] {
  const parsed: RwaContributionEvent[] = []
  rawEvents.forEach((raw, index) => {
    const event = parseContributionEvent(raw, index)
    if (event) parsed.push(event)
  })
  return parsed
}

/**
 * Soroban RPC backed chain reader.
 */
export class SorobanChainReader implements RwaChainReader {
  private readonly server: rpc.Server

  constructor(config: RwaConfig) {
    this.server = new rpc.Server(config.rpcUrl)
  }

  async getTransaction(txHash: string): Promise<RwaChainTransaction | null> {
    const response = await this.server.getTransaction(txHash)
    if (response.status === 'NOT_FOUND') return null

    const successful = response.status === 'SUCCESS'
    const ledger = 'ledger' in response ? response.ledger : 0
    return { successful, ledger }
  }

  async getNetworkPassphrase(): Promise<string | null> {
    const response = await this.server.getNetwork()
    return response?.passphrase ?? null
  }

  async getContractEvents(
    contractId: string,
    txHash: string,
  ): Promise<RwaRawEvent[]> {
    const transaction = await this.getTransaction(txHash)
    if (!transaction) return []

    // The RPC filters by ledger range, so the ledger of the transaction is used
    // as a narrow window and the transaction hash is matched exactly.
    const response = await this.server.getEvents({
      filters: [{ type: 'contract', contractIds: [contractId] }],
      startLedger: transaction.ledger,
      endLedger: transaction.ledger,
      limit: 200,
    })

    return response.events
      .filter((event) => event.txHash === txHash)
      .map((event) => ({
        id: event.id,
        txHash: event.txHash,
        contractId: event.contractId ? event.contractId.toString() : contractId,
        ledger: event.ledger,
        operationIndex: event.operationIndex,
        inSuccessfulContractCall: event.inSuccessfulContractCall,
        topic: event.topic ?? [],
        value: event.value,
      }))
  }
}

/** Build the chain reader for the current configuration. */
export function createChainReader(config: RwaConfig): RwaChainReader {
  return new SorobanChainReader(config)
}
