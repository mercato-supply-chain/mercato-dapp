import { test, expect, afterEach, mock } from 'bun:test'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { SupplierActivityPaginationControls } from '@/components/supplier-activity/pagination-controls'

mock.module('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

afterEach(() => {
  mock.restore()
  cleanup()
})

const labels = {
  prevPage: 'Previous',
  nextPage: 'Next',
  pagination: 'Page {page} of {total}',
}

test('renders nothing when there is only one page', () => {
  const { container } = render(
    <SupplierActivityPaginationControls
      page={1}
      totalPages={1}
      filterQuery={{}}
      labels={labels}
    />,
  )
  expect(container.firstChild).toBeNull()
})

test('shows only Next on the first page', () => {
  render(
    <SupplierActivityPaginationControls
      page={1}
      totalPages={3}
      filterQuery={{}}
      labels={labels}
    />,
  )
  expect(screen.getByText('Page 1 of 3')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Next' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull()
})

test('shows only Previous on the last page', () => {
  render(
    <SupplierActivityPaginationControls
      page={3}
      totalPages={3}
      filterQuery={{}}
      labels={labels}
    />,
  )
  expect(screen.getByRole('link', { name: 'Previous' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Next' })).toBeNull()
})

test('preserves filters in the generated links', () => {
  render(
    <SupplierActivityPaginationControls
      page={2}
      totalPages={3}
      filterQuery={{ company: 'company-1', status: 'needs_shipment' }}
      labels={labels}
    />,
  )
  const prevLink = screen.getByRole('link', { name: 'Previous' }) as HTMLAnchorElement
  const nextLink = screen.getByRole('link', { name: 'Next' }) as HTMLAnchorElement
  expect(prevLink.getAttribute('href')).toBe(
    '/dashboard/supplier-activity?company=company-1&status=needs_shipment',
  )
  expect(nextLink.getAttribute('href')).toBe(
    '/dashboard/supplier-activity?company=company-1&status=needs_shipment&page=3',
  )
})
