'use client'

import {
  development,
  mainNet,
  TrustlessWorkConfig,
} from '@trustless-work/escrow'
import type React from 'react'

export const TRUSTLESS_BASE_URL =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? mainNet : development

export const TRUSTLESS_API_KEY = process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY ?? ''

export const MERCATO_PLATFORM_ADDRESS =
  process.env.NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS ?? ''

interface TrustlessWorkProviderProps {
  children: React.ReactNode
}

export function TrustlessWorkProvider(props: TrustlessWorkProviderProps): React.JSX.Element {
  return TrustlessWorkConfig({
    baseURL: TRUSTLESS_BASE_URL,
    apiKey: TRUSTLESS_API_KEY,
    children: props.children,
  })
}
