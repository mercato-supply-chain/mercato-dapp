/**
 * Trustline configuration for Stellar assets used in escrow.
 * Address is configured via NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS.
 * @see https://docs.trustlesswork.com/trustless-work/pt/dapps-open-source/visao-geral-do-demo/trustlines
 */

const TRUSTLINE_ADDRESS = process.env.NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS ?? ''

export const USDC_TRUSTLINE = {
  name: 'USDC',
  symbol: 'USDC',
  address: TRUSTLINE_ADDRESS,
  /**
   * Stellar uses 7 decimal places (stroops).
   * Multiply human-readable amounts by this value before sending to the contract.
   */
  decimals: 10_000_000,
} as const

export const TRUSTLINES = [USDC_TRUSTLINE] as const
