import { test, expect, mock, afterEach } from 'bun:test'

import React from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { AdminTaskInboxDisputes } from '@/components/dashboard/admin/admin-task-inbox-disputes'
import { I18nProvider } from '@/lib/i18n/provider'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { AdminOverviewEscrowRef } from '@/lib/admin/types'

const getEscrowByContractIdsMock = mock<
  (params: { contractIds: string[] }) => Promise<GetEscrowsFromIndexerResponse[]>
>()

mock.module('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
  }),
}))

mock.module('@trustless-work/escrow/hooks', () => ({
  useGetEscrowFromIndexerByContractIds: () => ({
    getEscrowByContractIds: getEscrowByContractIdsMock,
  }),
}))

afterEach(() => {
  getEscrowByContractIdsMock.mockClear()
  cleanup()
})

const escrows: AdminOverviewEscrowRef[] = [
  { contractId: 'C1', dealId: 'deal-1', dealTitle: 'Deal One' },
]

function renderDisputes(overrides: AdminOverviewEscrowRef[] = escrows) {
  return render(
    <I18nProvider locale="en" messages={getDictionary('en')}>
      <AdminTaskInboxDisputes escrows={overrides} />
    </I18nProvider>,
  )
}

test('renders the unavailable message when the indexer request fails', async () => {
  getEscrowByContractIdsMock.mockRejectedValue(new Error('indexer down'))

  renderDisputes()

  expect(
    await screen.findByText('Dispute queue unavailable. Please try again later.'),
  ).toBeTruthy()
  expect(screen.queryByText(/live dispute check/i)).toBeNull()
  expect(screen.queryAllByRole('link').length).toBe(0)
})

test('keeps the normal empty behavior when the request succeeds with no disputes', async () => {
  getEscrowByContractIdsMock.mockResolvedValue([])

  renderDisputes()

  await waitFor(() => {
    expect(getEscrowByContractIdsMock).toHaveBeenCalled()
  })

  expect(screen.queryByText(/unavailable/i)).toBeNull()
  expect(screen.queryByText(/live dispute check/i)).toBeNull()
  expect(screen.queryByText('Disputed repayment on Deal One')).toBeNull()
  expect(screen.queryAllByRole('link').length).toBe(0)
})

test('renders disputed escrow links and actions when the request succeeds with disputes', async () => {
  getEscrowByContractIdsMock.mockResolvedValue([
    {
      contractId: 'C1',
      milestones: [{ description: 'first', flags: { disputed: true } }],
    } as unknown as GetEscrowsFromIndexerResponse,
  ])

  renderDisputes()

  expect(await screen.findByText('Disputed repayment on Deal One')).toBeTruthy()
  expect(screen.getByText('Critical')).toBeTruthy()
  expect(screen.getByText('Deal One · Disputed')).toBeTruthy()
  expect(screen.getByText('Resolve dispute')).toBeTruthy()

  const link = screen.getByRole('link', { name: /Resolve dispute/i })
  expect(link.getAttribute('href')).toBe('/deals/deal-1')
  expect(screen.queryByText(/unavailable/i)).toBeNull()
})
