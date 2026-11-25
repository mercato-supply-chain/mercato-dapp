import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import path from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Deal } from '@/lib/types'

import * as realSplitPayment from '@/lib/stellar/build-usdc-split-payment'
import * as realSorobanInvoke from '@/lib/stellar/build-soroban-invoke'
import * as realWalletKit from '@/lib/trustless/wallet-kit'
import * as realSubmit from '@/lib/stellar-submit'
import * as realTrustlessConfig from '@/lib/trustless/config'
import * as realPollar from '@/providers/pollar-provider'
import * as realUseWallet from '@/hooks/use-wallet'
import * as realI18n from '@/lib/i18n/provider'

const REPO_ROOT = path.resolve(import.meta.dir, '../../..')

// Module mocks in bun apply to the whole test run, so every stub below falls through to the real
// implementation unless this file's tests are running.
let active = false
const calls: Array<[string, unknown]> = []

const original = {
  buildUsdcSplitPaymentXdr: realSplitPayment.buildUsdcSplitPaymentXdr,
  buildAssembledSorobanInvoke: realSorobanInvoke.buildAssembledSorobanInvoke,
  signTransaction: realWalletKit.signTransaction,
  submitSignedTransaction: realSubmit.submitSignedTransaction,
  usePollarSession: realPollar.usePollarSession,
  useWallet: realUseWallet.useWallet,
  useI18n: realI18n.useI18n,
}

mock.module('@/lib/stellar/build-usdc-split-payment', () => ({
  ...realSplitPayment,
  buildUsdcSplitPaymentXdr: async (args: Parameters<typeof original.buildUsdcSplitPaymentXdr>[0]) => {
    if (!active) return original.buildUsdcSplitPaymentXdr(args)
    calls.push(['buildUsdcSplitPaymentXdr', args])
    return 'UNSIGNED_SPLIT_XDR'
  },
}))
mock.module('@/lib/stellar/build-soroban-invoke', () => ({
  ...realSorobanInvoke,
  buildAssembledSorobanInvoke: async (args: Parameters<typeof original.buildAssembledSorobanInvoke>[0]) => {
    if (!active) return original.buildAssembledSorobanInvoke(args)
    calls.push(['buildAssembledSorobanInvoke', args.functionName])
    return 'UNSIGNED_INVOKE_XDR'
  },
}))
mock.module('@/lib/trustless/wallet-kit', () => ({
  ...realWalletKit,
  signTransaction: async (args: Parameters<typeof original.signTransaction>[0]) => {
    if (!active) return original.signTransaction(args)
    calls.push(['signTransaction', args.unsignedTransaction])
    return `SIGNED(${args.unsignedTransaction})`
  },
}))
mock.module('@/lib/stellar-submit', () => ({
  ...realSubmit,
  submitSignedTransaction: async (signedXdr: string) => {
    if (!active) return original.submitSignedTransaction(signedXdr)
    calls.push(['submitSignedTransaction', signedXdr])
    return { successful: true, hash: 'TX_HASH' }
  },
}))
// A named import binds this value once, so it cannot switch with `active`. The repayment escrow
// tests set a fixed platform address the same way.
mock.module('@/lib/trustless/config', () => ({ ...realTrustlessConfig, MERCATO_PLATFORM_ADDRESS: 'GPLATFORM' }))
mock.module('@/providers/pollar-provider', () => ({
  ...realPollar,
  usePollarSession: () => (active ? { signAndSubmitTx: async () => 'POLLAR_HASH' } : original.usePollarSession()),
}))
mock.module('@/hooks/use-wallet', () => ({
  ...realUseWallet,
  useWallet: () => (active ? { provider: 'stellar-wallets-kit' } : original.useWallet()),
}))
// No other test imports the fund dialog, and importing the real one pulls in the DeFindex vault
// hooks that other test files mock, so this stub is not routed through the real module.
mock.module('@/components/deals/deal-fund-dialog', () => ({
  DealFundDialog: ({ onConfirmFund }: { onConfirmFund: (principal: number) => void }) => (
    <button type="button" onClick={() => onConfirmFund(100)}>
      confirm fund
    </button>
  ),
}))
mock.module('@/lib/i18n/provider', () => ({
  ...realI18n,
  useI18n: () => (active ? { locale: 'en', t: (key: string) => key } : original.useI18n()),
}))

function makeSupabase() {
  const eqResult = { error: null, single: async () => ({ data: { user_type: 'investor' } }) }
  const chain = { select: () => chain, update: () => chain, eq: () => eqResult }
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'investor-1' } } }) },
    from: () => chain,
  }
}

const baseDeal = {
  id: 'deal-1',
  status: 'awaiting_funding',
  supplierAddress: 'GSUPPLIER',
  priceUSDC: 100,
  investorFundingTotal: 101,
  rwaOptedIn: false,
} as unknown as Deal

async function renderPanel(deal: Deal) {
  const { DealFundingPanel } = await import('@/components/deals/deal-funding-panel')
  const onDealUpdate = mock(() => {})
  render(
    <DealFundingPanel
      deal={deal}
      isFundingOpen
      isPyme={false}
      userType="investor"
      isConnected
      walletAddress="GINVESTOR"
      onConnect={() => {}}
      canFund
      showMobileBar={false}
      supabase={makeSupabase() as never}
      fetchDeal={async () => ({ ...deal, status: 'funded' }) as Deal}
      onDealUpdate={onDealUpdate}
      userId="investor-1"
    />,
  )
  return { onDealUpdate }
}

describe('DealFundingPanel Stellar loading', () => {
  test('the deal page does not load the Stellar SDK or the transaction helpers until funding', () => {
    // A fresh process, so modules loaded by other test files cannot hide a static import.
    const script = `
      await import('@/app/deals/[id]/deal-detail-view')
      const loaded = Object.keys(require.cache).filter((k) =>
        /node_modules\\/@stellar\\/stellar-sdk\\/|lib\\/stellar\\/build-usdc-split-payment|lib\\/stellar\\/build-soroban-invoke|lib\\/stellar-submit/.test(k))
      console.log(JSON.stringify(loaded.map((k) => k.slice(k.indexOf(process.cwd()) + process.cwd().length))))
    `
    const run = Bun.spawnSync([process.execPath, '-e', script], { cwd: REPO_ROOT })
    expect(run.exitCode).toBe(0)
    expect(JSON.parse(run.stdout.toString().trim().split('\n').pop() ?? 'null')).toEqual([])
  })

  describe('funding flows', () => {
    const realFetch = globalThis.fetch
    let windowBefore: typeof globalThis.window

    beforeAll(() => {
      active = true
      // __tests__/hooks/use-scroll-motion.test.ts replaces the global window with a stub and never
      // restores it. Use happy-dom's window for these renders, then put back whatever was there.
      windowBefore = globalThis.window
      if (document.defaultView) globalThis.window = document.defaultView as typeof globalThis.window
    })
    afterAll(() => {
      active = false
      globalThis.window = windowBefore
    })
    beforeEach(() => {
      calls.length = 0
    })
    afterEach(() => {
      cleanup()
      globalThis.fetch = realFetch
    })

    test('direct USDC funding builds, signs and submits the split payment', async () => {
      const { onDealUpdate } = await renderPanel(baseDeal)
      fireEvent.click(screen.getByRole('button', { name: 'confirm fund' }))

      await waitFor(() => expect(onDealUpdate).toHaveBeenCalled())
      expect(calls).toEqual([
        [
          'buildUsdcSplitPaymentXdr',
          {
            sourceAddress: 'GINVESTOR',
            supplierAddress: 'GSUPPLIER',
            platformAddress: 'GPLATFORM',
            principal: 100,
          },
        ],
        ['signTransaction', 'UNSIGNED_SPLIT_XDR'],
        ['submitSignedTransaction', 'SIGNED(UNSIGNED_SPLIT_XDR)'],
      ])
    })

    test('RWA contribute builds, signs and submits the Soroban invoke', async () => {
      const posted: string[] = []
      globalThis.fetch = (async (url: string) => {
        posted.push(url)
        const body = url.endsWith('/prepare')
          ? {
              attemptId: 'attempt-1',
              call: {
                contractId: 'CCONTRACT',
                args: {
                  investor: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
                  principalUnits: '1000000000',
                  nonce: '1',
                  contributionRef: 'ab'.repeat(32),
                },
              },
            }
          : { targetReached: false }
        return new Response(JSON.stringify(body), { status: 200 })
      }) as typeof fetch

      const rwaDeal = { ...baseDeal, rwaOptedIn: true, rwaAssetId: 'asset-1' } as Deal
      const { onDealUpdate } = await renderPanel(rwaDeal)
      fireEvent.click(screen.getByRole('button', { name: 'confirm fund' }))

      await waitFor(() => expect(onDealUpdate).toHaveBeenCalled())
      expect(calls).toEqual([
        ['buildAssembledSorobanInvoke', 'contribute'],
        ['signTransaction', 'UNSIGNED_INVOKE_XDR'],
        ['submitSignedTransaction', 'SIGNED(UNSIGNED_INVOKE_XDR)'],
      ])
      expect(posted).toEqual([
        '/api/rwa/contributions/prepare',
        '/api/rwa/contributions/submit',
        '/api/rwa/contributions/confirm',
      ])
    })
  })
})
