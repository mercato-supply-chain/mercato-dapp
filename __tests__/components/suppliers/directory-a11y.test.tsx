import { afterEach, expect, mock, test } from 'bun:test'
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'

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
    messages: {
      geo: { countries: {}, sectors: {} },
      productCategories: {},
    },
  }),
}))

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

const SuppliersDirectory = (await import('@/app/suppliers/suppliers-directory')).default

afterEach(() => {
  mock.restore()
  cleanup()
})

const supplier = {
  id: 's1',
  owner_id: 'o1',
  company_name: 'Acme',
  logo_url: null,
  verified: true,
  country: 'CR',
  sector: 'retail',
  categories: ['tools'],
  products: ['hammer'],
  description: null,
  reputation_score: 0,
}

test('category pills are a labeled group with aria-pressed on each option', () => {
  render(<SuppliersDirectory initialSuppliers={[supplier] as never} />)

  const group = screen.getByRole('group', { name: 'suppliersPage.categoryGroupAria' })
  const pills = within(group).getAllByRole('button')
  expect(pills.length).toBeGreaterThan(0)
  for (const pill of pills) {
    expect(pill.getAttribute('aria-pressed')).not.toBeNull()
  }
  const pressed = pills.filter((p) => p.getAttribute('aria-pressed') === 'true')
  expect(pressed.length).toBe(1)
})

test('search input exposes an explicit accessible name', () => {
  render(<SuppliersDirectory initialSuppliers={[supplier] as never} />)

  const search = screen.getByLabelText('suppliersPage.searchAria')
  expect(search.tagName.toLowerCase()).toBe('input')
  expect(search.getAttribute('type')).toBe('search')
})

test('result count is a polite live region', () => {
  render(<SuppliersDirectory initialSuppliers={[supplier] as never} />)

  const status = screen.getByRole('status')
  expect(status.getAttribute('aria-live')).toBe('polite')
  expect(status.getAttribute('aria-atomic')).toBe('true')
})
