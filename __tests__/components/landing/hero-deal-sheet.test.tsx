import { afterEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import { interpolate, lookup, type Replacements } from '@/lib/i18n/messages'
import { sampleHeroDeal, type LandingHeroDeal } from '@/lib/landing/hero-deal'

let activeLocale: 'en' | 'es' = 'en'

mock.module('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// The photo is decorative (alt="", aria-hidden); nothing to assert on.
mock.module('next/image', () => ({ default: () => null }))

/** Real dictionaries, so a missing key fails the test instead of rendering the raw key. */
mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: activeLocale,
    t: (key: string, replacements?: Replacements) => {
      const value = lookup(activeLocale === 'es' ? es : en, key)
      if (value === undefined) throw new Error(`Missing ${activeLocale} message: ${key}`)
      return interpolate(value, replacements)
    },
  }),
}))

const { HeroDealSheet } = await import('@/components/landing/hero-deal-sheet')

afterEach(() => {
  activeLocale = 'en'
  cleanup()
})

const liveDeal: LandingHeroDeal = {
  source: 'live',
  href: '/deals/abc',
  reference: 'ABC12345',
  productName: 'LED panels',
  buyerName: 'Andes Retail',
  supplierName: 'Andes Components SAS',
  quantity: 400,
  invoiceAmount: 38_200,
  termDays: 45,
  ratePercent: 6.25,
  investorProfit: 2_387.5,
  investorReceives: 40_587.5,
}

describe('HeroDealSheet', () => {
  test('leads with buyer, supplier, invoice, and what the investor receives', () => {
    render(<HeroDealSheet deal={liveDeal} />)

    expect(screen.getByRole('article', { name: 'Featured deal' })).toBeTruthy()
    expect(screen.getByText('Open for funding')).toBeTruthy()
    expect(screen.getByText('Deal ABC12345')).toBeTruthy()
    expect(screen.getByText('Andes Retail')).toBeTruthy()
    expect(screen.getByText('Andes Components SAS')).toBeTruthy()
    expect(screen.getByText('$38,200')).toBeTruthy()
    expect(screen.getByText('$40,587.50')).toBeTruthy()
    expect(
      screen.getByText(/\$38,200 principal \+ \$2,387\.50 yield after 45 days · 6\.25% for the term/),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review this deal' }).getAttribute('href')).toBe(
      '/deals/abc',
    )
  })

  test('labels sample terms as an example and links to the marketplace', () => {
    render(<HeroDealSheet deal={sampleHeroDeal()} />)

    expect(screen.getByText('Example deal')).toBeTruthy()
    expect(screen.queryByText(/^Deal /)).toBeNull()
    expect(screen.getByText('Manufacturas del Norte')).toBeTruthy()
    expect(screen.getByText(/Illustrative terms/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Browse open deals' }).getAttribute('href')).toBe(
      '/deals',
    )
  })

  test('renders in Spanish with localized numbers', () => {
    activeLocale = 'es'
    render(<HeroDealSheet deal={liveDeal} />)

    expect(screen.getByText('Abierta para financiar')).toBeTruthy()
    expect(screen.getByText('El inversionista recibe')).toBeTruthy()
    expect(screen.getByText(/6\.25% por el plazo/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver esta operación' })).toBeTruthy()
  })
})
