'use client'

import {
  development,
  mainNet,
  TrustlessWorkConfig,
} from '@trustless-work/escrow'
import React from 'react'

export const TRUSTLESS_BASE_URL =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? mainNet : development

export const TRUSTLESS_API_KEY = process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY ?? ''

export const MERCATO_PLATFORM_ADDRESS =
  process.env.NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS ?? ''

/**
 * Dispute arbiter for repayment escrows. Defaults to the platform wallet.
 * Must differ from the platform address if platform needs to *open* disputes
 * (Trustless Work forbids the disputeResolver from raising disputes).
 */
export const MERCATO_DISPUTE_RESOLVER_ADDRESS =
  process.env.NEXT_PUBLIC_MERCATO_DISPUTE_RESOLVER_ADDRESS?.trim() ||
  MERCATO_PLATFORM_ADDRESS

/** All operational TW roles for repayment escrows (investor is milestone receiver only). */
export function repaymentEscrowRoles() {
  if (!MERCATO_PLATFORM_ADDRESS) {
    throw new Error('Platform address not configured')
  }
  return {
    approver: MERCATO_PLATFORM_ADDRESS,
    serviceProvider: MERCATO_PLATFORM_ADDRESS,
    platformAddress: MERCATO_PLATFORM_ADDRESS,
    releaseSigner: MERCATO_PLATFORM_ADDRESS,
    disputeResolver: MERCATO_DISPUTE_RESOLVER_ADDRESS || MERCATO_PLATFORM_ADDRESS,
  }
}

interface TrustlessWorkProviderProps {
  children: React.ReactNode
}

export function TrustlessWorkProvider({ children }: TrustlessWorkProviderProps): React.JSX.Element {
  return React.createElement(TrustlessWorkConfig, {
    baseURL: TRUSTLESS_BASE_URL,
    apiKey: TRUSTLESS_API_KEY,
    children,
  })
}
