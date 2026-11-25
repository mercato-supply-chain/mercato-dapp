import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let unreadCount = 0

mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}(${Object.values(params).join(',')})` : key,
  }),
}))

mock.module('@/hooks/use-mounted', () => ({ useMounted: () => false }))

mock.module('@/components/notifications/notifications-provider', () => ({
  useNotificationsContext: () => ({
    notifications: [],
    unreadCount,
    isLoading: false,
    markAsRead: async () => undefined,
    markAllAsRead: async () => undefined,
  }),
}))

mock.module('@/hooks/use-mercato-wallet', () => ({
  useMercatoWallet: () => ({
    provider: 'stellar-wallets-kit',
    publicKey: 'GABC',
    status: 'active',
    isConnected: true,
    isEmbedded: false,
    balances: { usdc: '10', xlm: '5' },
    txHistory: null,
    walletName: 'Freighter',
    connectExternalWallet: () => undefined,
    connectPollarWallet: () => undefined,
    disconnect: () => undefined,
    refreshBalance: async () => undefined,
  }),
}))

const { NotificationDropdown } = await import('@/components/notifications/notification-dropdown')
const { WalletStatusCard } = await import('@/components/wallet/wallet-status-card')

afterEach(() => {
  cleanup()
})

describe('notification bell', () => {
  test('is named without unread items', () => {
    unreadCount = 0
    render(<NotificationDropdown />)
    expect(screen.getByRole('button', { name: 'notifications.ariaLabel' })).toBeTruthy()
  })

  test('includes the unread count in its name', () => {
    unreadCount = 3
    render(<NotificationDropdown />)
    expect(
      screen.getByRole('button', { name: 'notifications.ariaLabel, notifications.unreadCount(3)' }),
    ).toBeTruthy()
  })
})

describe('wallet status card', () => {
  test('names the icon controls and announces a finished refresh', async () => {
    const user = userEvent.setup()
    render(<WalletStatusCard />)

    expect(screen.getByRole('button', { name: 'walletStatus.copyAddress' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'walletStatus.viewExplorerAriaLabel' })).toBeTruthy()

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')

    await user.click(screen.getByRole('button', { name: 'walletStatus.refreshBalance' }))

    expect(status.textContent).toBe('walletStatus.balanceRefreshed')
  })
})
