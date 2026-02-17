/**
 * Trustline configuration for Stellar assets used in escrow.
 * Address is configured via NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS.
 * @see https://docs.trustlesswork.com/trustless-work/pt/dapps-open-source/visao-geral-do-demo/trustlines
 */

const TRUSTLINE_ADDRESS = process.env.NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS ?? ''

/** 10^7 — Stellar classic assets use 7 decimal places (stroops). */
export const USDC_DECIMALS = 10_000_000

export const USDC_TRUSTLINE = {
  name: 'USDC',
  symbol: 'USDC',
  address: TRUSTLINE_ADDRESS,
  /**
   * Stellar uses 7 decimal places (stroops).
   * Multiply human-readable amounts by this value when the API expects stroops (e.g. initialize escrow milestones).
   */
  decimals: USDC_DECIMALS,
} as const

export const TRUSTLINES = [USDC_TRUSTLINE] as const
