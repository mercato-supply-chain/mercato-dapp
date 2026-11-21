import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { mockDeals } from '@/__tests__/fixtures/mock-deals'
import { enDict, type Messages } from '@/lib/i18n/dictionaries'
import esRaw from '@/messages/es.json'
const esDict: Messages = esRaw as Messages
import { scopedMessages, translate, type Replacements } from '@/lib/i18n/messages'
import type { Deal } from '@/lib/types'
import type { WalletProviderType } from '@/lib/mercato-wallet'
import * as TrustlessConfigNamespace from '@/lib/trustless/config'
import * as NextNavigationNamespace from 'next/navigation'
import * as NavigationComponentNamespace from '@/components/navigation'
import * as PollarProviderNamespace from '@/providers/pollar-provider'
import * as UseRepaymentEscrowNamespace from '@/hooks/use-repayment-escrow'
import * as UseAdminReopenDealNamespace from '@/hooks/use-admin-reopen-deal'
import * as WalletKitNamespace from '@/lib/trustless/wallet-kit'
import * as StellarSubmitNamespace from '@/lib/stellar-submit'
import * as SplitPaymentNamespace from '@/lib/stellar/build-usdc-split-payment'
import * as SonnerNamespace from 'sonner'

const TEST_PLATFORM_ADDRESS = 'GPLATFORMADDRESS1111111111111111111111111111111111111111'

const realI18nProviderPath: string = '@/lib/i18n/provider.tsx?actual'
const realUseWalletPath: string = '@/hooks/use-wallet.ts?actual'
const realUseDealDetailPath: string = '@/hooks/use-deal-detail.ts?actual'
const realDealFundDialogPath: string = '@/components/deals/deal-fund-dialog.tsx?actual'

const I18nProviderOriginal = (await import(
  realI18nProviderPath
)) as typeof import('@/lib/i18n/provider')
const UseWalletOriginal = (await import(
  realUseWalletPath
)) as typeof import('@/hooks/use-wallet')
const UseDealDetailOriginal = (await import(
  realUseDealDetailPath
)) as typeof import('@/hooks/use-deal-detail')

const TrustlessConfigOriginal = { ...TrustlessConfigNamespace }
const NextNavigationOriginal = { ...NextNavigationNamespace }
const NavigationComponentOriginal = { ...NavigationComponentNamespace }
const PollarProviderOriginal = { ...PollarProviderNamespace }
const UseRepaymentEscrowOriginal = { ...UseRepaymentEscrowNamespace }
const UseAdminReopenDealOriginal = { ...UseAdminReopenDealNamespace }
const WalletKitOriginal = { ...WalletKitNamespace }
const StellarSubmitOriginal = { ...StellarSubmitNamespace }
const SplitPaymentOriginal = { ...SplitPaymentNamespace }
const SonnerOriginal = { ...SonnerNamespace }

const REPO_ROOT = resolve(import.meta.dir, '../..')

function readRepoFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8')
}

function stripCommentsLexically(source: string): string {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '/' && next === '/') {
      i += 2
      while (i < n && source[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n'
        i += 1
      }
      i += 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      out += ch
      i += 1
      while (i < n) {
        const c = source[i]
        out += c
        i += 1
        if (c === '\\' && i < n) {
          out += source[i]
          i += 1
          continue
        }
        if (c === quote) break
      }
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function extractPropsPropertyNames(relPath: string): string[] {
  const cleaned = stripCommentsLexically(readRepoFile(relPath))
  const propNames: string[] = []
  const declHeader = /\b(?:interface|type)\s+\w*Props\b[^{]*\{/g
  let match: RegExpExecArray | null = declHeader.exec(cleaned)
  while (match) {
    let idx = match.index + match[0].length
    let depth = 1
    let body = ''
    while (idx < cleaned.length && depth > 0) {
      const ch = cleaned[idx]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      if (depth > 0) body += ch
      idx += 1
    }
    const propRegex = /(?:^|\n|;)\s*([A-Za-z_$][\w$]*)\s*\??\s*:/g
    let pm: RegExpExecArray | null = propRegex.exec(body)
    while (pm) {
      propNames.push(pm[1])
      pm = propRegex.exec(body)
    }
    match = declHeader.exec(cleaned)
  }
  return propNames
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    ...mockDeals[0],
    ...overrides,
  }
}

let activeLocale: 'en' | 'es' = 'en'

const walletState: {
  isConnected: boolean
  address: string
  provider: WalletProviderType | null
} = {
  isConnected: true,
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  provider: 'stellar-wallets-kit',
}

let approveAndReleaseSpy = mock(async (): Promise<void> => undefined)
let fundRepaymentSpy = mock(async () => undefined)
let syncDealSpy = mock(async () => null)
let signTransactionImpl: (opts: {
  unsignedTransaction: string
  address: string
}) => Promise<string | null> = async ({ unsignedTransaction }) => `SIGNED:${unsignedTransaction}`
let submitSignedTxImpl: (signedXdr: string) => Promise<{ successful: boolean; hash: string }> =
  async (signedXdr) => ({ successful: true, hash: `HASH:${signedXdr}` })
const builtSplitPayments: Array<{ sourceAddress: string; principal: number }> = []
const toastSuccessCalls: string[] = []
const toastErrorCalls: string[] = []

let activeDealDetailStub: ReturnType<typeof UseDealDetailOriginal.useDealDetail> | null = null

const stableRouter = {
  push: () => undefined,
  replace: () => undefined,
  refresh: () => undefined,
  prefetch: () => undefined,
  back: () => undefined,
  forward: () => undefined,
}
const stableSearchParams = new URLSearchParams()
const stableParams = { id: '1' }

mock.module('@/lib/trustless/config', () => ({
  ...TrustlessConfigOriginal,
  MERCATO_PLATFORM_ADDRESS: TEST_PLATFORM_ADDRESS,
}))

mock.module('sonner', () => ({
  ...SonnerOriginal,
  toast: {
    ...SonnerOriginal.toast,
    success: (msg: unknown) => {
      toastSuccessCalls.push(String(msg))
      return 'toast-ok'
    },
    error: (msg: unknown) => {
      toastErrorCalls.push(String(msg))
      return 'toast-err'
    },
  },
}))

mock.module('next/navigation', () => ({
  ...NextNavigationOriginal,
  useRouter: () => stableRouter,
  usePathname: () => '/deals/1',
  useParams: () => stableParams,
  useSearchParams: () => stableSearchParams,
}))

mock.module('@/components/navigation', () => ({
  Navigation: () => <header data-testid="stub-nav" />,
}))

mock.module('@/components/deals/deal-fund-dialog', () => ({
  DealFundDialog: ({
    open,
    onOpenChange,
    onConfirmFund,
    isFunding,
    trigger,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirmFund: (contributionPrincipal?: number) => void
    isFunding: boolean
    trigger?: React.ReactNode
  }) => (
    <div
      data-testid="deal-fund-dialog-instance"
      data-open={open ? 'true' : 'false'}
      data-funding={isFunding ? 'true' : 'false'}
    >
      {trigger ?? (
        <button type="button" onClick={() => onOpenChange(true)}>
          {translate(activeLocale === 'es' ? esDict : enDict, enDict, 'deals.fundThisDeal')}
        </button>
      )}
      {open ? (
        <div data-testid="deal-fund-dialog-controls">
          <button
            type="button"
            data-testid="confirm-fund-default"
            disabled={isFunding}
            onClick={() => onConfirmFund()}
          >
            Confirm Default Fund
          </button>
          <button
            type="button"
            data-testid="confirm-fund-500"
            disabled={isFunding}
            onClick={() => onConfirmFund(500)}
          >
            Confirm 500
          </button>
          <button
            type="button"
            data-testid="confirm-fund-1000"
            disabled={isFunding}
            onClick={() => onConfirmFund(1000)}
          >
            Confirm 1000
          </button>
        </div>
      ) : null}
    </div>
  ),
}))

mock.module('@/lib/stellar/build-usdc-split-payment', () => ({
  ...SplitPaymentOriginal,
  buildUsdcSplitPaymentXdr: async (args: { sourceAddress: string; principal: number }) => {
    builtSplitPayments.push({ sourceAddress: args.sourceAddress, principal: args.principal })
    return `XDR:${args.sourceAddress}:${args.principal}`
  },
}))

mock.module('@/lib/trustless/wallet-kit', () => ({
  ...WalletKitOriginal,
  signTransaction: (opts: { unsignedTransaction: string; address: string }) =>
    signTransactionImpl(opts),
}))

mock.module('@/lib/stellar-submit', () => ({
  ...StellarSubmitOriginal,
  submitSignedTransaction: (signedXdr: string) => submitSignedTxImpl(signedXdr),
}))

mock.module('@/hooks/use-wallet', () => ({
  ...UseWalletOriginal,
  useWallet: () => ({
    walletInfo: walletState.isConnected
      ? {
          address: walletState.address,
          walletName: walletState.provider === 'pollar' ? 'Pollar' : 'Freighter',
        }
      : null,
    isConnected: walletState.isConnected,
    truncatedAddress: walletState.isConnected ? 'GAAA…AWHF' : null,
    provider: walletState.isConnected ? walletState.provider : null,
    publicKey: walletState.isConnected ? walletState.address : null,
    walletId: null,
    status: walletState.isConnected ? ('active' as const) : null,
    isEmbedded: walletState.provider === 'pollar',
    balances: {
      xlm: '100',
      usdc: '5000',
      records: [],
      source: 'horizon' as const,
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    txHistory: null,
    canSignTransactions: walletState.isConnected,
    connectExternalWallet: async () => undefined,
    connectPollarWallet: async () => undefined,
    handleConnect: async () => undefined,
    handleDisconnect: async () => undefined,
    disconnectWallet: async () => undefined,
    refreshBalance: async () => undefined,
  }),
}))

mock.module('@/providers/pollar-provider', () => ({
  ...PollarProviderOriginal,
  usePollarSession: () =>
    ({
      ...PollarProviderOriginal.usePollarSession(),
      isConfigured: false,
      signAndSubmitTx: async () => 'tx-hash',
    }) as ReturnType<typeof PollarProviderOriginal.usePollarSession>,
}))

mock.module('@/hooks/use-repayment-escrow', () => ({
  ...UseRepaymentEscrowOriginal,
  useRepaymentEscrow: () =>
    ({
      isWorking: false,
      deployRepaymentEscrow: async () => 'C_ESCROW',
      fundRepaymentEscrow: (...args: unknown[]) => fundRepaymentSpy(...(args as [])),
      approveAndReleaseMilestone: (...args: unknown[]) => approveAndReleaseSpy(...(args as [])),
      addRepaymentMilestone: async () => undefined,
      syncDealFromIndexer: (...args: unknown[]) => syncDealSpy(...(args as [])),
    }) as unknown as ReturnType<typeof UseRepaymentEscrowOriginal.useRepaymentEscrow>,
}))

mock.module('@/hooks/use-admin-reopen-deal', () => ({
  ...UseAdminReopenDealOriginal,
  useAdminReopenDeal: () => ({
    submit: async () => ({ ok: true as const, deal: {} }),
    isSubmitting: false,
  }),
}))

mock.module('@/hooks/use-deal-detail', () => ({
  ...UseDealDetailOriginal,
  useDealDetail: () => {
    if (!activeDealDetailStub) {
      throw new Error('Expected activeDealDetailStub to be configured in test')
    }
    return activeDealDetailStub
  },
}))

mock.module('@/lib/i18n/provider', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useI18n: () => {
    const activeDict = activeLocale === 'es' ? esDict : enDict
    return {
      locale: activeLocale,
      t: (key: string, replacements?: Replacements) =>
        translate(activeDict, enDict, key, replacements),
      messages: activeDict,
      setLocale: () => undefined,
    }
  },
  useI18nNamespace: (ns: string) => {
    const activeDict = activeLocale === 'es' ? esDict : enDict
    return {
      messages: scopedMessages(activeDict, ns),
      t: (subKey: string, replacements?: Replacements) =>
        translate(activeDict, enDict, `${ns}.${subKey}`, replacements),
    }
  },
}))

beforeEach(() => {
  const domWin = document.defaultView
  if (domWin && globalThis.window !== domWin) {
    globalThis.window = domWin
  }
  activeLocale = 'en'
  walletState.isConnected = true
  walletState.address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  walletState.provider = 'stellar-wallets-kit'
  approveAndReleaseSpy = mock(async (): Promise<void> => undefined)
  fundRepaymentSpy = mock(async () => undefined)
  syncDealSpy = mock(async () => null)
  signTransactionImpl = async ({ unsignedTransaction }) => `SIGNED:${unsignedTransaction}`
  submitSignedTxImpl = async (signedXdr) => ({ successful: true, hash: `HASH:${signedXdr}` })
  builtSplitPayments.length = 0
  toastSuccessCalls.length = 0
  toastErrorCalls.length = 0
  activeDealDetailStub = null
})

afterEach(() => {
  cleanup()
  activeDealDetailStub = null
})

afterAll(async () => {
  const domWin = document.defaultView
  if (domWin && globalThis.window !== domWin) {
    globalThis.window = domWin
  }
  mock.module('@/lib/trustless/config', () => ({ ...TrustlessConfigOriginal }))
  mock.module('sonner', () => ({ ...SonnerOriginal }))
  mock.module('next/navigation', () => ({ ...NextNavigationOriginal }))
  mock.module('@/components/navigation', () => ({ ...NavigationComponentOriginal }))
  try {
    const DealFundDialogOriginal = (await import(
      realDealFundDialogPath
    )) as typeof import('@/components/deals/deal-fund-dialog')
    mock.module('@/components/deals/deal-fund-dialog', () => ({ ...DealFundDialogOriginal }))
  } catch {
    // Keep stub if an earlier suite partially mocked `@/lib/defindex/vault-cache` without `vaultMetaRequest`
  }
  mock.module('@/lib/stellar/build-usdc-split-payment', () => ({ ...SplitPaymentOriginal }))
  mock.module('@/lib/trustless/wallet-kit', () => ({ ...WalletKitOriginal }))
  mock.module('@/lib/stellar-submit', () => ({ ...StellarSubmitOriginal }))
  mock.module('@/hooks/use-wallet', () => ({ ...UseWalletOriginal }))
  mock.module('@/providers/pollar-provider', () => ({ ...PollarProviderOriginal }))
  mock.module('@/hooks/use-repayment-escrow', () => ({ ...UseRepaymentEscrowOriginal }))
  mock.module('@/hooks/use-admin-reopen-deal', () => ({ ...UseAdminReopenDealOriginal }))
  mock.module('@/hooks/use-deal-detail', () => ({ ...UseDealDetailOriginal }))
  mock.module('@/lib/i18n/provider', () => ({ ...I18nProviderOriginal }))
})

function buildDealDetailContext(
  deal: Deal,
  roleOverrides: Partial<ReturnType<typeof UseDealDetailOriginal.useDealDetail>>,
): ReturnType<typeof UseDealDetailOriginal.useDealDetail> {
  return {
    deal,
    setDeal: () => undefined,
    isLoading: false,
    userId: 'user-1',
    userType: 'pyme',
    isSupplier: false,
    isPyme: false,
    isAdmin: false,
    indexerEscrow: null,
    pymeReputation: null,
    supplierReputation: null,
    partyReputationsLoading: false,
    fetchDeal: async () => deal,
    supabase: {} as never,
    walletInfo: walletState.isConnected
      ? { address: walletState.address, walletName: 'Freighter' }
      : null,
    isConnected: walletState.isConnected,
    handleConnect: async () => undefined,
    loadError: null,
    retry: () => undefined,
    ...roleOverrides,
  } as ReturnType<typeof UseDealDetailOriginal.useDealDetail>
}

describe('Issue #281 — Role-split deal action panels', () => {
  it('resolves explicit viewer roles including non-party authenticated viewers vs guests', async () => {
    const { resolveDealViewerRole } = await import('@/lib/deals/viewer-role')
    expect(
      resolveDealViewerRole({ userId: 'u1', userType: 'admin', isPyme: true, isSupplier: true, isAdmin: true }),
    ).toBe('admin')
    expect(
      resolveDealViewerRole({ userId: 'u1', userType: 'pyme', isPyme: true, isSupplier: false, isAdmin: false }),
    ).toBe('pyme')
    expect(
      resolveDealViewerRole({ userId: 'u1', userType: 'supplier', isPyme: false, isSupplier: true, isAdmin: false }),
    ).toBe('supplier')
    expect(
      resolveDealViewerRole({ userId: 'u1', userType: 'investor', isPyme: false, isSupplier: false, isAdmin: false }),
    ).toBe('investor')
    expect(
      resolveDealViewerRole({ userId: 'other-pyme', userType: null, isPyme: false, isSupplier: false, isAdmin: false }),
    ).toBe('authenticated_viewer')
    expect(
      resolveDealViewerRole({ userId: null, userType: null, isPyme: false, isSupplier: false, isAdmin: false }),
    ).toBe('guest')
  })

  it('eliminates role, wallet-connection, and hidden role-branching boolean props across all shared frames and role action components', () => {
    const checkedFiles = [
      'components/deals/deal-funding-panel.tsx',
      'components/deals/deal-investor-hero.tsx',
      'components/deals/deal-delivery-flow.tsx',
      'components/deals/deal-repayment-panel.tsx',
      'components/deals/deal-milestone-actions.tsx',
      'components/deals/deal-admin-reopen-panel.tsx',
      'components/deals/deal-delivery-panel.tsx',
      'components/deals/actions/funding-status-notice.tsx',
      'components/deals/actions/admin-release-actions.tsx',
    ]

    const bannedProps = new Set([
      'isPyme',
      'isAdmin',
      'isInvestor',
      'isSupplier',
      'isConnected',
      'canFund',
      'userType',
      'isAuthenticatedViewer',
      'showApprovalsLink',
    ])

    for (const rel of checkedFiles) {
      const props = extractPropsPropertyNames(rel)
      for (const p of props) {
        expect(bannedProps.has(p)).toBe(false)
      }
    }

    const fundingFrameSrc = readRepoFile('components/deals/deal-funding-panel.tsx')
    expect(fundingFrameSrc).not.toContain('investor-fund-actions')
    expect(fundingFrameSrc).not.toContain('DealFundDialog')
  })

  it('never mounts investor funding controls on a PyME deal detail page and distinguishes signed-in non-investors from guests', async () => {
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')

    const deal = makeDeal({
      status: 'awaiting_funding',
      fundingStatus: 'open',
      pymeId: 'pyme-owner',
      supplierAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB222',
    })
    activeDealDetailStub = buildDealDetailContext(deal, {
      userId: 'pyme-owner',
      userType: 'pyme',
      isPyme: true,
    })

    let pymeView!: ReturnType<typeof render>
    await act(async () => {
      pymeView = render(<DealDetailPage />)
    })

    expect(pymeView.queryByTestId('deal-fund-dialog-instance')).toBeNull()
    expect(pymeView.queryByText(enDict.deals.fundThisDeal)).toBeNull()
    expect(pymeView.getByText(enDict.dealDetail.onlyInvestorsFund)).toBeTruthy()
    cleanup()

    activeDealDetailStub = buildDealDetailContext(deal, {
      userId: 'signed-in-non-party',
      userType: null,
      isPyme: false,
      isSupplier: false,
      isAdmin: false,
    })
    let authViewer!: ReturnType<typeof render>
    await act(async () => {
      authViewer = render(<DealDetailPage />)
    })
    expect(authViewer.getByText(enDict.dealDetail.onlyInvestorsFund)).toBeTruthy()
    expect(authViewer.queryByText(enDict.dealDetail.signInToFund)).toBeNull()
  })

  it('[281-P1-1 / ADV-281-2] mounts a single DealFundDialog, unlocks after wallet signature rejection, and invalidates submittedTxRef when principal, wallet, or investor changes', async () => {
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')

    let currentAuthUid = 'investor-1'
    let failDbSync = true
    const recordedDealUpdates: Array<Record<string, unknown>> = []
    const recordedProfileUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []

    const supabaseStub = {
      auth: {
        getUser: async () => ({ data: { user: { id: currentAuthUid } }, error: null }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { user_type: 'investor' }, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          if (table === 'deals') {
            if (failDbSync) {
              const failChain = {
                eq: () => failChain,
                is: () => ({
                  select: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: new Error('Transient DB write timeout'),
                    }),
                  }),
                }),
              }
              return failChain
            }
            recordedDealUpdates.push(payload)
            const okChain = {
              eq: () => okChain,
              is: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'deal-fund-281' },
                    error: null,
                  }),
                }),
              }),
            }
            return okChain
          }
          return {
            eq: async (_col: string, id: string) => {
              recordedProfileUpdates.push({ id, payload })
              return { error: null }
            },
          }
        },
      }),
    }

    const deal = makeDeal({
      id: 'deal-fund-281',
      status: 'awaiting_funding',
      fundingStatus: 'open',
      priceUSDC: 1000,
      supplierAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB222',
    })

    activeDealDetailStub = buildDealDetailContext(deal, {
      userId: 'investor-1',
      userType: 'investor',
      supabase: supabaseStub as never,
      fetchDeal: async () =>
        failDbSync
          ? deal
          : { ...deal, status: 'funded', fundingStatus: 'funded', investorId: currentAuthUid },
    })

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<DealDetailPage />)
    })

    const dialogInstances = view.getAllByTestId('deal-fund-dialog-instance')
    expect(dialogInstances).toHaveLength(1)
    const buttons = view.getAllByText(new RegExp(enDict.deals.fundThisDeal))
    expect(buttons).toHaveLength(2)

    await act(async () => {
      fireEvent.click(buttons[1])
    })
    expect(dialogInstances[0].getAttribute('data-open')).toBe('true')

    // 1. User rejects wallet signature -> lock must release cleanly so subsequent click works
    signTransactionImpl = async () => {
      throw new Error('User rejected request')
    }
    await act(async () => {
      fireEvent.click(view.getByTestId('confirm-fund-500'))
    })
    expect(toastErrorCalls.some((m) => m.includes('User rejected request'))).toBe(true)

    // 2. Retry 500 USDC with WALLET_1 -> on-chain succeeds, DB sync fails
    walletState.address = 'GWALLET1111111111111111111111111111111111111111111111111'
    view.rerender(<DealDetailPage />)
    signTransactionImpl = async ({ unsignedTransaction }) => `SIGNED:${unsignedTransaction}`
    await act(async () => {
      fireEvent.click(view.getByTestId('confirm-fund-500'))
    })
    expect(builtSplitPayments).toHaveLength(2)

    // 3. Same user/wallet/principal retries when DB recovers -> reuses cached txHash without double-spending
    failDbSync = false
    await act(async () => {
      fireEvent.click(view.getByTestId('confirm-fund-500'))
    })
    expect(builtSplitPayments).toHaveLength(2)
    expect(recordedDealUpdates).toHaveLength(1)
    cleanup()

    // 4. Changing principal / wallet / userId invalidates submittedTxRef and builds a fresh tx
    builtSplitPayments.length = 0
    recordedDealUpdates.length = 0
    failDbSync = true
    walletState.address = 'GWALLET1111111111111111111111111111111111111111111111111'
    activeDealDetailStub = buildDealDetailContext(deal, {
      userId: 'investor-1',
      userType: 'investor',
      supabase: supabaseStub as never,
      fetchDeal: async () =>
        failDbSync
          ? deal
          : { ...deal, status: 'funded', fundingStatus: 'funded', investorId: currentAuthUid },
    })

    let view2!: ReturnType<typeof render>
    await act(async () => {
      view2 = render(<DealDetailPage />)
    })
    await act(async () => {
      fireEvent.click(view2.getAllByText(new RegExp(enDict.deals.fundThisDeal))[0])
    })
    await act(async () => {
      fireEvent.click(view2.getByTestId('confirm-fund-500'))
    })
    expect(builtSplitPayments).toHaveLength(1)

    failDbSync = false
    currentAuthUid = 'investor-2'
    walletState.address = 'GWALLET2222222222222222222222222222222222222222222222222'
    activeDealDetailStub = buildDealDetailContext(deal, {
      userId: 'investor-2',
      userType: 'investor',
      supabase: supabaseStub as never,
      fetchDeal: async () => ({
        ...deal,
        status: 'funded',
        fundingStatus: 'funded',
        investorId: 'investor-2',
      }),
    })
    view2.rerender(<DealDetailPage />)

    await act(async () => {
      fireEvent.click(view2.getByTestId('confirm-fund-1000'))
    })
    expect(builtSplitPayments).toHaveLength(2)
    expect(builtSplitPayments[1]).toEqual({
      sourceAddress: 'GWALLET2222222222222222222222222222222222222222222222222',
      principal: 1000,
    })
    expect(recordedDealUpdates[0]).toMatchObject({
      investor_id: 'investor-2',
      funding_tx_hash:
        'HASH:SIGNED:XDR:GWALLET2222222222222222222222222222222222222222222222222:1000',
    })
  })

  it('[281-P0-1] preserves BOTH admin reopen and PyME extend actions on Admin+PyME expired deal overlap without duplicate banners', async () => {
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')

    const expiredDeal = makeDeal({
      status: 'awaiting_funding',
      fundingStatus: 'expired',
      pymeId: 'admin-pyme-owner',
    })
    activeDealDetailStub = buildDealDetailContext(expiredDeal, {
      userId: 'admin-pyme-owner',
      userType: 'admin',
      isAdmin: true,
      isPyme: true,
    })

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<DealDetailPage />)
    })

    expect(view.getByText(enDict.dealDetail.adminReopenCta)).toBeTruthy()
    expect(view.getByText(enDict.dealDetail.extendFundingCta)).toBeTruthy()
    expect(view.getAllByText(enDict.dealDetail.fundingExpired)).toHaveLength(1)
    expect(view.queryByText(enDict.deals.fundThisDeal)).toBeNull()
  })

  it('[281-P1-2] renders DealDeliveryFlow in en/es and rejects 0-row optimistic concurrency updates in SupplierShipActions & PymeConfirmDeliveryActions', async () => {
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')

    let simulateZeroRowConflict = false
    const updates: Array<Record<string, unknown>> = []
    const makeChain = () => {
      const chain = {
        eq: () => chain,
        neq: () => chain,
        is: () => chain,
        select: () => ({
          maybeSingle: async () => ({
            data: simulateZeroRowConflict ? null : { id: '1' },
            error: null,
          }),
          single: async () => ({
            data: simulateZeroRowConflict ? null : { id: '1' },
            error: null,
          }),
        }),
        then: (res: (v: { error: null }) => unknown) =>
          Promise.resolve({ error: null }).then(res),
      }
      return chain
    }
    const supabaseStub = {
      from: () => ({
        update: (payload: Record<string, unknown>) => {
          updates.push(payload)
          return makeChain()
        },
      }),
    }

    const unshippedDeal = makeDeal({
      status: 'funded',
      fundingStatus: 'funded',
      shippedAt: undefined,
      deliveredAt: undefined,
      repaymentStatus: 'none',
    })
    activeDealDetailStub = buildDealDetailContext(unshippedDeal, {
      userId: 'dual-1',
      userType: 'pyme',
      isPyme: true,
      isSupplier: true,
      supabase: supabaseStub as never,
    })

    for (const locale of ['en', 'es'] as const) {
      activeLocale = locale
      const dict = locale === 'es' ? esDict : enDict
      let view!: ReturnType<typeof render>
      await act(async () => {
        view = render(<DealDetailPage />)
      })

      expect(view.container.textContent).not.toMatch(/\bdealDetail\.[A-Za-z0-9_]+/)
      expect(view.getByText(dict.dealDetail.deliveryStepShip)).toBeTruthy()
      expect(view.getByText(dict.dealDetail.deliveryStepReceive)).toBeTruthy()
      expect(view.getByText(dict.dealDetail.deliveryStepRepayment)).toBeTruthy()

      if (locale === 'en') {
        simulateZeroRowConflict = true
        toastSuccessCalls.length = 0
        toastErrorCalls.length = 0
        const input = view.container.querySelector('#shipment-tracking-id') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'DHL-CONFLICT' } })
        await act(async () => {
          fireEvent.click(view.getByText(dict.dealDetail.deliveryConfirmShipCta))
        })
        expect(toastSuccessCalls).toHaveLength(0)
        expect(toastErrorCalls.length).toBeGreaterThan(0)

        simulateZeroRowConflict = false
        toastErrorCalls.length = 0
        fireEvent.change(input, { target: { value: 'DHL-998877' } })
        await act(async () => {
          fireEvent.click(view.getByText(dict.dealDetail.deliveryConfirmShipCta))
        })
        expect(toastSuccessCalls).toContain(dict.dealDetail.deliveryShippedSuccess)
        expect(updates.at(-1)).toMatchObject({
          tracking_id: 'DHL-998877',
          status: 'in_progress',
        })
      }

      cleanup()
    }

    activeLocale = 'en'
    simulateZeroRowConflict = true
    toastSuccessCalls.length = 0
    toastErrorCalls.length = 0
    const shippedDeal = makeDeal({
      status: 'in_progress',
      shippedAt: '2026-11-20T00:00:00.000Z',
      deliveredAt: undefined,
      repaymentStatus: 'none',
    })
    activeDealDetailStub = buildDealDetailContext(shippedDeal, {
      userId: 'pyme-1',
      userType: 'pyme',
      isPyme: true,
      supabase: supabaseStub as never,
    })

    let pymeDeliverView!: ReturnType<typeof render>
    await act(async () => {
      pymeDeliverView = render(<DealDetailPage />)
    })
    await act(async () => {
      fireEvent.click(pymeDeliverView.getByText(enDict.dealDetail.deliveryConfirmReceivedCta))
    })
    expect(toastSuccessCalls).toHaveLength(0)
    expect(toastErrorCalls.length).toBeGreaterThan(0)
  })

  it('[281-P0-1 & 281-P1-3 / ADV-281-1 & ADV-281-3] blocks unauthenticated guest AdminReleaseActions, gates Pollar Soroban signing symmetrically, and enforces synchronous ref locks against double-clicks', async () => {
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')
    const { DealRepaymentPanel } = await import('@/components/deals/deal-repayment-panel')
    const { AdminReleaseActions } = await import('@/components/deals/actions/admin-release-actions')
    const { PymeRepayActions } = await import('@/components/deals/actions/pyme-repay-actions')
    const { AdminSettleSupplierAction } = await import(
      '@/components/deals/actions/admin-settle-supplier-action'
    )
    const { PymeFundingActions } = await import('@/components/deals/actions/pyme-funding-actions')
    const { SupplierMilestoneAction } = await import(
      '@/components/deals/actions/milestone-role-actions'
    )

    const releaseDeal = makeDeal({
      status: 'in_progress',
      repaymentStatus: 'ready_to_release',
      escrowAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      repaymentTotalAmount: 1100,
      repaymentMilestones: [
        { index: 0, description: 'Milestone 1', amount: 1100, released: false },
      ],
    })

    walletState.address = TEST_PLATFORM_ADDRESS
    activeDealDetailStub = buildDealDetailContext(releaseDeal, {
      userId: null,
      userType: null,
      isAdmin: false,
      isPyme: false,
      isSupplier: false,
      walletInfo: { address: TEST_PLATFORM_ADDRESS, walletName: 'Freighter' },
    })

    let guestView!: ReturnType<typeof render>
    await act(async () => {
      guestView = render(<DealDetailPage />)
    })
    expect(guestView.queryAllByRole('button', { name: /Release milestone/i })).toHaveLength(0)
    cleanup()

    walletState.isConnected = true
    walletState.provider = 'pollar'
    walletState.address = 'GPOLLARWALLET11111111111111111111111111111111111111111111'

    let pollarRepayView!: ReturnType<typeof render>
    await act(async () => {
      pollarRepayView = render(
        <DealRepaymentPanel
          deal={releaseDeal}
          fetchDeal={async () => releaseDeal}
          onDealUpdate={() => undefined}
          actions={
            <>
              <PymeRepayActions deal={releaseDeal} />
              <AdminReleaseActions deal={releaseDeal} />
            </>
          }
        />,
      )
    })
    const pollarReleaseBtn = pollarRepayView.getByRole('button', {
      name: /Release milestone/i,
    }) as HTMLButtonElement
    const pollarPymeRepayBtn = pollarRepayView.getByRole('button', {
      name: new RegExp(enDict.dealDetail.repaymentFundCta.split('{')[0].trim(), 'i'),
    }) as HTMLButtonElement
    expect(pollarReleaseBtn.disabled).toBe(true)
    expect(pollarPymeRepayBtn.disabled).toBe(true)
    cleanup()

    const milestoneDeal = makeDeal({
      status: 'funded',
      escrowAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      milestones: [{ id: 'm1', name: 'Shipment of Goods', percentage: 50, status: 'pending' }],
    })
    const pollarSupplierMs = render(
      <SupplierMilestoneAction
        deal={milestoneDeal}
        milestone={milestoneDeal.milestones[0]}
        index={0}
        total={2}
        signAndSend={async () => undefined}
        changeMilestoneStatus={async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })}
        supabase={{} as never}
        fetchDeal={async () => milestoneDeal}
        onDealUpdate={() => undefined}
      />,
    )
    const acceptBtn = pollarSupplierMs.getByRole('button', {
      name: enDict.dealDetail.acceptOrderRelease,
    }) as HTMLButtonElement
    expect(acceptBtn.disabled).toBe(true)
    cleanup()

    walletState.provider = 'stellar-wallets-kit'
    const originalFetch = globalThis.fetch
    let settleCalls = 0
    let resolveSettle!: () => void
    globalThis.fetch = mock(
      () =>
        new Promise<Response>((res) => {
          settleCalls += 1
          resolveSettle = () => res(new Response('{}', { status: 200 }))
        }),
    ) as unknown as typeof fetch

    try {
      const rwaReadyDeal = makeDeal({
        rwaOptedIn: true,
        rwaAssetId: 'asset-1',
        rwaLifecycle: 'ready_to_settle',
      })
      const settleView = render(
        <AdminSettleSupplierAction
          deal={rwaReadyDeal}
          fetchDeal={async () => rwaReadyDeal}
          onDealUpdate={() => undefined}
        />,
      )
      const settleBtn = settleView.getByRole('button', { name: 'Settle supplier' })
      await act(async () => {
        fireEvent.click(settleBtn)
        fireEvent.click(settleBtn)
      })
      expect(settleCalls).toBe(1)
      await act(async () => {
        resolveSettle()
      })
      cleanup()
    } finally {
      globalThis.fetch = originalFetch
    }

    let extendCalls = 0
    let resolveExtend!: () => void
    const extendSupabase = {
      from: () => ({
        update: () => {
          extendCalls += 1
          const ch = {
            eq: () => ch,
            is: () => ch,
            select: () => ({
              single: () =>
                new Promise<{ data: { id: string }; error: null }>((res) => {
                  resolveExtend = () => res({ data: { id: '1' }, error: null })
                }),
              maybeSingle: () =>
                new Promise<{ data: { id: string }; error: null }>((res) => {
                  resolveExtend = () => res({ data: { id: '1' }, error: null })
                }),
            }),
          }
          return ch
        },
      }),
    }
    const expiredPymeDeal = makeDeal({
      status: 'awaiting_funding',
      fundingStatus: 'expired',
      pymeId: 'pyme-1',
    })
    const extendView = render(
      <PymeFundingActions
        deal={expiredPymeDeal}
        isFundingOpen={false}
        supabase={extendSupabase as never}
        fetchDeal={async () => expiredPymeDeal}
        onDealUpdate={() => undefined}
        userId="pyme-1"
      />,
    )
    await act(async () => {
      fireEvent.click(extendView.getByText(enDict.dealDetail.extendFundingCta))
    })
    const confirmExtBtn = extendView.getByText(enDict.dealDetail.confirmExtension)
    await act(async () => {
      fireEvent.click(confirmExtBtn)
      fireEvent.click(confirmExtBtn)
    })
    expect(extendCalls).toBe(1)
    await act(async () => {
      resolveExtend()
    })
    cleanup()

    let signAndSendCalls = 0
    let resolveSignAndSend!: () => void
    const swkSupplierMs = render(
      <SupplierMilestoneAction
        deal={milestoneDeal}
        milestone={milestoneDeal.milestones[0]}
        index={0}
        total={2}
        signAndSend={() =>
          new Promise<void>((res) => {
            signAndSendCalls += 1
            resolveSignAndSend = res
          })
        }
        changeMilestoneStatus={async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })}
        supabase={{
          from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
        } as never}
        fetchDeal={async () => milestoneDeal}
        onDealUpdate={() => undefined}
      />,
    )
    const swkAcceptBtn = swkSupplierMs.getByRole('button', {
      name: enDict.dealDetail.acceptOrderRelease,
    })
    await act(async () => {
      fireEvent.click(swkAcceptBtn)
      fireEvent.click(swkAcceptBtn)
    })
    expect(signAndSendCalls).toBe(1)
    await act(async () => {
      resolveSignAndSend()
    })
  })

  it('resolves viewer role atomically in useDealDetail without intermediate flash and clears privileges on SIGNED_OUT', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react')
    const SupabaseClientMod = await import('@/lib/supabase/client')
    const SupabaseOrig = { ...SupabaseClientMod }
    const EscrowHooksMod = await import('@trustless-work/escrow/hooks')
    const EscrowHooksOrig = { ...EscrowHooksMod }

    let authCallback: ((event: string, session: { user: { id: string } } | null) => void) | null = null
    mock.module('@/lib/supabase/client', () => ({
      ...SupabaseOrig,
      createClient: () =>
        ({
          auth: {
            getUser: async () => ({ data: { user: { id: 'admin-u1' } }, error: null }),
            onAuthStateChange: (cb: typeof authCallback) => {
              authCallback = cb
              return { data: { subscription: { unsubscribe: () => undefined } } }
            },
          },
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                single: async () => {
                  if (table === 'profiles') {
                    return { data: { user_type: 'admin' }, error: null }
                  }
                  return {
                    data: {
                      id: 'd-auth-1',
                      pyme_id: 'pyme-other',
                      title: 'Deal Auth',
                      description: '',
                      category: 'other',
                      product_name: 'Deal Auth',
                      product_quantity: 1,
                      product_unit_price: 100,
                      supplier_name: 'Sup',
                      amount: 100,
                      interest_rate: 10,
                      term_days: 30,
                      status: 'seeking_funding',
                      milestones: [],
                    },
                    error: null,
                  }
                },
              }),
            }),
          }),
        }) as unknown as ReturnType<typeof SupabaseOrig.createClient>,
    }))
    mock.module('@trustless-work/escrow/hooks', () => ({
      ...EscrowHooksOrig,
      useGetEscrowFromIndexerByContractIds: () => ({
        getEscrowByContractIds: async () => [],
      }),
    }))

    try {
      const observedReadySnapshots: Array<{ userId: string | null; userType: string | null }> = []
      const hook = renderHook(() => {
        const res = UseDealDetailOriginal.useDealDetail('d-auth-1')
        if (!res.isLoading && res.deal) {
          observedReadySnapshots.push({ userId: res.userId, userType: res.userType })
        }
        return res
      })

      await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
      expect(hook.result.current.userId).toBe('admin-u1')
      expect(hook.result.current.userType).toBe('admin')
      expect(hook.result.current.isAdmin).toBe(true)
      expect(
        observedReadySnapshots.some((snap) => snap.userId === 'admin-u1' && snap.userType === null),
      ).toBe(false)

      await act(async () => {
        authCallback?.('SIGNED_OUT', null)
      })
      await waitFor(() => expect(hook.result.current.userId).toBeNull())
      expect(hook.result.current.userType).toBeNull()
      expect(hook.result.current.isAdmin).toBe(false)
      hook.unmount()
    } finally {
      mock.module('@/lib/supabase/client', () => ({ ...SupabaseOrig }))
      mock.module('@trustless-work/escrow/hooks', () => ({ ...EscrowHooksOrig }))
    }
  })

  it('mounts role-specific milestone actions inside DealMilestoneActions without cross-role leakage', async () => {
    const { DealMilestoneActions } = await import('@/components/deals/deal-milestone-actions')
    const {
      SupplierMilestoneAction,
      ConfirmDeliveryMilestoneAction,
    } = await import('@/components/deals/actions/milestone-role-actions')

    const deal = makeDeal({
      status: 'funded',
      escrowAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      milestones: [
        { id: 'm1', name: 'Shipment of Goods', percentage: 50, status: 'pending' },
        { id: 'm2', name: 'Final Delivery Confirmation', percentage: 50, status: 'pending' },
      ],
    })

    const supplierView = render(
      <DealMilestoneActions
        deal={deal}
        renderMilestoneAction={(milestone, index, total) => (
          <SupplierMilestoneAction
            deal={deal}
            milestone={milestone}
            index={index}
            total={total}
            signAndSend={async () => undefined}
            changeMilestoneStatus={async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })}
            supabase={{} as never}
            fetchDeal={async () => deal}
            onDealUpdate={() => undefined}
          />
        )}
      />,
    )
    expect(supplierView.getByText(enDict.dealDetail.acceptOrderRelease)).toBeTruthy()
    expect(supplierView.getByText(enDict.dealDetail.pymeWillConfirmMilestone)).toBeTruthy()
    expect(supplierView.queryByText(enDict.dealDetail.confirmDeliveryBtn)).toBeNull()
    cleanup()

    const pymeView = render(
      <DealMilestoneActions
        deal={deal}
        renderMilestoneAction={(milestone, index, total) => (
          <ConfirmDeliveryMilestoneAction
            milestone={milestone}
            index={index}
            total={total}
            onOpenProofDialog={() => undefined}
          />
        )}
      />,
    )
    expect(pymeView.getByText(enDict.dealDetail.confirmDeliveryBtn)).toBeTruthy()
    expect(pymeView.queryByText(enDict.dealDetail.acceptOrderRelease)).toBeNull()
  })

  it('[P1-3] handles 0-row classic funding conflict without false success, profile update, referral call, or clearing retry protection', async () => {
    const { InvestorFundActions } = await import('@/components/deals/actions/investor-fund-actions')

    const profileUpdates: Array<Record<string, unknown>> = []
    const onDealUpdateCalls: Deal[] = []
    const referralCalls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      referralCalls.push(String(input))
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const deal = makeDeal({
      id: 'deal-conflict-281',
      pymeId: 'pyme-ref-1',
      status: 'awaiting_funding',
      fundingStatus: 'open',
      priceUSDC: 500,
      supplierAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB222',
    })
    const fundedByOther: Deal = {
      ...deal,
      status: 'funded',
      fundingStatus: 'funded',
      investorId: 'other-investor-99',
    }

    const conflictSupabase = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'investor-1' } }, error: null }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { user_type: 'investor' }, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          if (table === 'deals') {
            const zeroRowChain = {
              eq: () => zeroRowChain,
              is: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }
            return zeroRowChain
          }
          return {
            eq: async () => {
              profileUpdates.push(payload)
              return { error: null }
            },
          }
        },
      }),
    }

    try {
      const view = render(
        <InvestorFundActions
          deal={deal}
          isFundingOpen={true}
          supabase={conflictSupabase as never}
          fetchDeal={async () => fundedByOther}
          onDealUpdate={(next) => onDealUpdateCalls.push(next)}
          userId="investor-1"
        />,
      )

      await act(async () => {
        fireEvent.click(view.getByText(enDict.deals.fundThisDeal))
      })
      const dialog = view.getByTestId('deal-fund-dialog-instance')
      expect(dialog.getAttribute('data-open')).toBe('true')

      await act(async () => {
        fireEvent.click(view.getByTestId('confirm-fund-500'))
      })

      expect(toastSuccessCalls).toHaveLength(0)
      expect(toastErrorCalls).toContain(enDict.dealDetail.errorFundingDbSync)
      expect(profileUpdates).toHaveLength(0)
      expect(referralCalls).toHaveLength(0)
      expect(onDealUpdateCalls).toEqual([fundedByOther])
      expect(dialog.getAttribute('data-open')).toBe('true')
      expect(builtSplitPayments).toHaveLength(1)

      // Retry with same params must reuse submittedTxRef (proving retry protection was preserved)
      await act(async () => {
        fireEvent.click(view.getByTestId('confirm-fund-500'))
      })
      expect(builtSplitPayments).toHaveLength(1)
      expect(toastSuccessCalls).toHaveLength(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('[P2-2 & P2-3] renders Pollar capabilityWarning in SupplierMilestoneAction and deduplicates synchronous double-clicks in DealAdminReopenPanel', async () => {
    const { SupplierMilestoneAction } = await import(
      '@/components/deals/actions/milestone-role-actions'
    )
    const { getWalletCapabilityLimitation } = await import('@/lib/mercato-wallet')

    walletState.isConnected = true
    walletState.provider = 'pollar'
    walletState.address = 'GPOLLARWALLET11111111111111111111111111111111111111111111'

    const milestoneDeal = makeDeal({
      status: 'funded',
      escrowAddress: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      milestones: [{ id: 'm1', name: 'Shipment of Goods', percentage: 50, status: 'pending' }],
    })
    const expectedWarning = getWalletCapabilityLimitation('pollar')
    expect(expectedWarning).toBeTruthy()

    const supplierView = render(
      <SupplierMilestoneAction
        deal={milestoneDeal}
        milestone={milestoneDeal.milestones[0]}
        index={0}
        total={2}
        signAndSend={async () => undefined}
        changeMilestoneStatus={async () => ({ status: 'SUCCESS', unsignedTransaction: 'XDR' })}
        supabase={{} as never}
        fetchDeal={async () => milestoneDeal}
        onDealUpdate={() => undefined}
      />,
    )
    const acceptBtn = supplierView.getByRole('button', {
      name: enDict.dealDetail.acceptOrderRelease,
    }) as HTMLButtonElement
    expect(acceptBtn.disabled).toBe(true)
    expect(supplierView.getByText(expectedWarning!)).toBeTruthy()
    cleanup()

    const { DealAdminReopenPanel } = await import('@/components/deals/deal-admin-reopen-panel')
    mock.module('@/hooks/use-admin-reopen-deal', () => ({ ...UseAdminReopenDealOriginal }))

    const originalFetch = globalThis.fetch
    let patchCalls = 0
    let resolvePatch!: () => void
    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/deals/update' && init?.method === 'PATCH') {
        patchCalls += 1
        return new Promise<Response>((res) => {
          resolvePatch = () =>
            res(
              new Response(JSON.stringify({ id: 'deal-reopen-281' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
        })
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    }) as unknown as typeof fetch

    try {
      const expiredDeal = makeDeal({
        id: 'deal-reopen-281',
        status: 'awaiting_funding',
        fundingStatus: 'expired',
        fundingWindowDays: 7,
      })
      const onReopenedSpy = mock(async () => undefined)
      const reopenView = render(
        <DealAdminReopenPanel deal={expiredDeal} onReopened={onReopenedSpy} />,
      )

      await act(async () => {
        fireEvent.click(reopenView.getByText(enDict.dealDetail.adminReopenCta))
      })
      const confirmBtn = reopenView.getByText(enDict.dealDetail.adminReopenConfirm)

      await act(async () => {
        fireEvent.click(confirmBtn)
        fireEvent.click(confirmBtn)
      })
      expect(patchCalls).toBe(1)

      await act(async () => {
        resolvePatch()
      })
      expect(onReopenedSpy).toHaveBeenCalledTimes(1)
      expect(toastSuccessCalls).toContain(enDict.dealDetail.adminReopenSuccess)
    } finally {
      globalThis.fetch = originalFetch
      mock.module('@/hooks/use-admin-reopen-deal', () => ({
        ...UseAdminReopenDealOriginal,
        useAdminReopenDeal: () => ({
          submit: async () => ({ ok: true as const, deal: {} }),
          isSubmitting: false,
        }),
      }))
    }
  })

  it('[v6 P2-3 & P2-4] completes classic funding retry idempotently when Attempt 1 committed DB update before transient fetchDeal null, handles PymeExtendFundingDialog 0-row race via maybeSingle, and hides SupplierShipActions when awaiting_funding', async () => {
    const { InvestorFundActions } = await import('@/components/deals/actions/investor-fund-actions')
    const { PymeExtendFundingDialog } = await import(
      '@/components/deals/actions/pyme-funding-actions'
    )
    const { SupplierShipActions } = await import(
      '@/components/deals/actions/supplier-ship-actions'
    )

    const originalFetch = globalThis.fetch
    const referralCalls: Array<{ milestone: string; dealId: string }> = []
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/referral/milestone' && init?.body) {
        referralCalls.push(JSON.parse(String(init.body)))
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    try {
      const openDeal = makeDeal({
        id: 'deal-idem-281',
        status: 'awaiting_funding',
        fundingStatus: 'open',
        priceUSDC: 500,
        pymeId: 'pyme-idem-1',
        supplierAddress: 'GSUPPLIERIDEM1111111111111111111111111111111111111111111',
      })
      let dbCommittedByInvestor1 = false
      let fetchDealAttempt = 0
      const profileWalletWrites: Array<{ id: string; address: unknown }> = []
      const updatedDeals: Deal[] = []

      const idemSupabase = {
        auth: {
          getUser: async () => ({ data: { user: { id: 'investor-1' } }, error: null }),
        },
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { user_type: 'investor' }, error: null }),
                }),
              }),
              update: (payload: { address?: unknown }) => ({
                eq: async (_col: string, id: string) => {
                  profileWalletWrites.push({ id, address: payload.address })
                  return { error: null }
                },
              }),
            }
          }
          if (table === 'deals') {
            return {
              update: () => {
                const chain = {
                  eq: () => chain,
                  is: () => chain,
                  select: () => ({
                    maybeSingle: async () => {
                      if (!dbCommittedByInvestor1) {
                        dbCommittedByInvestor1 = true
                        return { data: { id: openDeal.id }, error: null }
                      }
                      return { data: null, error: null }
                    },
                  }),
                }
                return chain
              },
            }
          }
          throw new Error(`Unexpected table ${table}`)
        },
      }

      const fetchDealIdem = mock(async () => {
        fetchDealAttempt += 1
        // Attempt 1 post-commit fetchDeal transiently returns null
        if (fetchDealAttempt === 1) return null
        return makeDeal({
          ...openDeal,
          status: 'in_progress',
          investorId: 'investor-1',
        })
      })

      const fundView = render(
        <InvestorFundActions
          deal={openDeal}
          isFundingOpen={true}
          supabase={idemSupabase as never}
          fetchDeal={fetchDealIdem}
          onDealUpdate={(d) => updatedDeals.push(d)}
          userId="investor-1"
        />,
      )

      // Open funding dialog
      await act(async () => {
        fireEvent.click(fundView.getByText(enDict.deals.fundThisDeal))
      })

      // Attempt 1: submits on-chain + commits deals.update, then fetchDeal returns null -> surfaces errorFundingDbSync
      await act(async () => {
        fireEvent.click(fundView.getByTestId('confirm-fund-default'))
      })
      expect(builtSplitPayments).toHaveLength(1)
      expect(toastErrorCalls).toEqual([enDict.dealDetail.errorFundingDbSync])
      expect(toastSuccessCalls).toHaveLength(0)

      // Attempt 2 (retry): reuses cached txHash (no second XDR build/spend), sees updatedRow = null but latestDeal.investorId === 'investor-1', completes idempotently
      await act(async () => {
        fireEvent.click(fundView.getByTestId('confirm-fund-default'))
      })
      expect(builtSplitPayments).toHaveLength(1)
      expect(toastErrorCalls).toEqual([enDict.dealDetail.errorFundingDbSync])
      expect(toastSuccessCalls).toContain(enDict.dealDetail.toastFundSuccess)
      expect(updatedDeals).toHaveLength(1)
      expect(updatedDeals[0]?.investorId).toBe('investor-1')
      expect(profileWalletWrites.some((w) => w.id === 'investor-1')).toBe(true)
      expect(referralCalls).toEqual([{ milestone: 'deal_funded', dealId: 'deal-idem-281' }])
      expect(fundView.getByTestId('deal-fund-dialog-instance').getAttribute('data-open')).toBe(
        'false',
      )
      cleanup()

      // Part 2: PymeExtendFundingDialog 0-row race uses maybeSingle(), refreshes deal, and toasts localized errorDealIneligibleExtendDb
      toastErrorCalls.length = 0
      const expiredPymeDeal = makeDeal({
        id: 'deal-ext-race-281',
        pymeId: 'pyme-owner-1',
        status: 'awaiting_funding',
        fundingStatus: 'expired',
        fundingWindowDays: 7,
      })
      const concurrentlyFundedDeal = makeDeal({
        ...expiredPymeDeal,
        status: 'funded',
        investorId: 'rival-investor',
      })
      const pymeUpdatedDeals: Deal[] = []
      const pymeRaceSupabase = {
        from: () => ({
          update: () => {
            const chain = {
              eq: () => chain,
              is: () => chain,
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    code: 'PGRST116',
                    message: 'JSON object requested, multiple (or no) rows returned',
                  },
                }),
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }
            return chain
          },
        }),
      }

      const pymeView = render(
        <PymeExtendFundingDialog
          deal={expiredPymeDeal}
          supabase={pymeRaceSupabase as never}
          fetchDeal={async () => concurrentlyFundedDeal}
          onDealUpdate={(d) => pymeUpdatedDeals.push(d)}
          userId="pyme-owner-1"
        />,
      )
      await act(async () => {
        fireEvent.click(pymeView.getByText(enDict.dealDetail.extendFundingCta))
      })
      await act(async () => {
        fireEvent.click(pymeView.getByText(enDict.dealDetail.confirmExtension))
      })
      expect(pymeUpdatedDeals).toHaveLength(1)
      expect(pymeUpdatedDeals[0]?.status).toBe('funded')
      expect(toastErrorCalls).toEqual([enDict.dealDetail.errorDealIneligibleExtendDb])
      cleanup()

      // Part 3: SupplierShipActions renders nothing when deal is still awaiting_funding
      const unfundedShipView = render(
        <SupplierShipActions
          deal={openDeal}
          supabase={{} as never}
          onRefresh={async () => undefined}
        />,
      )
      expect(unfundedShipView.container.innerHTML).toBe('')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
