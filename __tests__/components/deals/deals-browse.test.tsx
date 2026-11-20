import { test, expect, mock, afterEach } from 'bun:test'
import React from 'react'
import { render, screen, within, cleanup } from '@testing-library/react'
import { mockDeals } from '@/__tests__/fixtures/mock-deals'

mock.module('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}))

mock.module('@/components/navigation', () => ({
  Navigation: () => null,
}))

mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}))

// Radix Select relies on browser APIs that are not implemented in happy-dom.
mock.module('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({
    children,
    ...props
  }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const { DealsBrowse } = await import('@/app/deals/deals-browse')

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  mock.restore()
  cleanup()
})

const baseProps = {
  initialDeals: mockDeals,
  initialPage: 1,
  initialHasMore: false,
  initialMatchCount: mockDeals.length,
  initialSummary: {
    total: 6,
    open: 3,
    expired: 0,
    active: 2,
    completed: 1,
    totalValue: 213_500,
  },
  initialCategories: ['Electronics', 'Food & Beverage'],
  initialFilters: {
    status: 'all' as const,
    category: null,
    q: '',
    sort: 'newest' as const,
    page: 1,
  },
}

test('renders the first page from server props without a client fetch', () => {
  const fetchSpy = mock(() => Promise.reject(new Error('unexpected client fetch')))
  globalThis.fetch = fetchSpy as unknown as typeof fetch

  render(<DealsBrowse {...baseProps} />)

  expect(screen.getByText(mockDeals[0].productName)).toBeTruthy()
  expect(screen.getByText(mockDeals[1].productName)).toBeTruthy()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('renders a load-more control when the server reports another page', () => {
  render(<DealsBrowse {...baseProps} initialHasMore={true} initialMatchCount={24} />)

  expect(screen.getByText(mockDeals[0].productName)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'deals.loadMore' })).toBeTruthy()
})

test('status pills are a labeled group with aria-pressed on each option', () => {
  render(<DealsBrowse {...baseProps} />)

  const group = screen.getByRole('group', { name: 'deals.filterStatusAria' })
  const pills = within(group).getAllByRole('button')
  expect(pills.length).toBeGreaterThan(0)
  for (const pill of pills) {
    expect(pill.getAttribute('aria-pressed')).not.toBeNull()
  }
  const pressed = pills.filter((p) => p.getAttribute('aria-pressed') === 'true')
  expect(pressed.length).toBe(1)
})

test('search input exposes an explicit accessible name', () => {
  render(<DealsBrowse {...baseProps} />)

  const search = screen.getByLabelText('deals.searchAria')
  expect(search.tagName.toLowerCase()).toBe('input')
  expect(search.getAttribute('type')).toBe('search')
})

test('category and sort triggers expose explicit labels after a value is selected', () => {
  render(<DealsBrowse {...baseProps} />)

  expect(screen.getByLabelText('deals.filterCategoryAria')).toBeTruthy()
  expect(screen.getByLabelText('deals.filterSortAria')).toBeTruthy()
})

test('result count is a polite live region', () => {
  render(<DealsBrowse {...baseProps} />)

  const status = screen.getByRole('status')
  expect(status.getAttribute('aria-live')).toBe('polite')
  expect(status.getAttribute('aria-atomic')).toBe('true')
})
