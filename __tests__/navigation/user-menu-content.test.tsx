import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as nextNavigation from 'next/navigation'

let pathname = '/dashboard/admin/approvals'

mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}))

mock.module('next/navigation', () => ({
  ...nextNavigation,
  usePathname: () => pathname,
}))

const { UserMenuContent } = await import('@/components/navigation/user-menu-content')

afterEach(() => {
  cleanup()
})

function renderMenu(userType: string) {
  return render(
    <UserMenuContent
      user={{ id: 'user-1', email: 'ada@mercato.test' }}
      profile={{ full_name: 'Ada Admin', user_type: userType }}
      onLogout={() => undefined}
      variant="mobile"
    />,
  )
}

describe('UserMenuContent', () => {
  test('admin menu shows one group at a time', async () => {
    pathname = '/dashboard/admin/approvals'
    const user = userEvent.setup()
    renderMenu('admin')

    expect(screen.getByRole('tab', { name: 'dashboardNav.sectionWork', selected: true })).toBeTruthy()
    expect(screen.getByText('userMenu.hintApprovals')).toBeTruthy()
    expect(screen.queryByText('userMenu.hintUsers')).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'dashboardNav.sectionPeople' }))

    expect(screen.getByText('userMenu.hintUsers')).toBeTruthy()
    expect(screen.queryByText('userMenu.hintApprovals')).toBeNull()
  })

  test('pyme menu lists its shortcuts without a group switcher', () => {
    pathname = '/dashboard'
    renderMenu('pyme')

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('link', { name: 'dashboardNav.createDeal' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'dashboardNav.deals' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toBeTruthy()
  })
})
