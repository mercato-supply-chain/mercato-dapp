/** Base32 account (G…) or contract (C…) strkey: 56 chars after prefix. */
const STRKEY_BODY = '[A-Z2-7]{55}$'

/** Stellar account public key (`G…`). */
export function isLikelyStellarAccountId(address: string): boolean {
  return new RegExp(`^G${STRKEY_BODY}`).test(address)
}

export function isLikelyStellarContractId(address: string): boolean {
  return new RegExp(`^C${STRKEY_BODY}`).test(address)
}
