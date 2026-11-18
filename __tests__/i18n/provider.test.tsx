import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React, { useEffect, useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import * as nextNavigation from 'next/navigation'
import { dictionaries, type Messages } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

let refreshes = 0
let cookieWrites: string[] = []

// happy-dom drops cookies on about:blank, so record what the provider writes.
Object.defineProperty(document, 'cookie', {
  configurable: true,
  get: () => cookieWrites.at(-1) ?? '',
  set: (value: string) => {
    cookieWrites.push(value)
  },
})

mock.module('next/navigation', () => ({
  ...nextNavigation,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    refresh: () => {
      refreshes += 1
    },
    back: () => {},
    forward: () => {},
  }),
}))

// Other suites mock.module('@/lib/i18n/provider') and Bun shares those mocks process-wide;
// the query suffix loads the real module regardless of test order.
const realProvider: string = '@/lib/i18n/provider.tsx?actual'
const { I18nProvider, useI18n } = (await import(realProvider)) as typeof import('@/lib/i18n/provider')

const { en, es } = dictionaries

// Simulates the RSC payload: each server render deserializes a fresh messages object.
function serverMessages(locale: Locale): Messages {
  return structuredClone(dictionaries[locale])
}

let mounts = 0
let setLocaleRef: ((locale: Locale) => void) | null = null

function Probe() {
  const { locale, t, setLocale } = useI18n()
  // Local state stands in for wallet-provider state that must survive a locale switch.
  const [instance] = useState(() => ++mounts)
  useEffect(() => {
    setLocaleRef = setLocale
  }, [setLocale])
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t('nav.main')}</span>
      <span data-testid="instance">{instance}</span>
    </div>
  )
}

function tree(locale: Locale, messages: Messages) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <Probe />
    </I18nProvider>
  )
}

function expectRendered(locale: Locale) {
  expect(screen.getByTestId('locale').textContent).toBe(locale)
  expect(screen.getByTestId('label').textContent).toBe(dictionaries[locale].nav.main)
  expect(document.documentElement.lang).toBe(locale)
}

function switchTo(locale: Locale) {
  act(() => setLocaleRef?.(locale))
}

beforeEach(() => {
  refreshes = 0
  mounts = 0
  setLocaleRef = null
  document.documentElement.lang = ''
  cookieWrites = []
})

afterEach(() => {
  cleanup()
})

describe('I18nProvider server reconciliation', () => {
  test('sanity: fixture labels differ between locales', () => {
    expect(en.nav.main).not.toBe(es.nav.main)
  })

  test('rerendering with es server props replaces en translations without remounting', () => {
    const { rerender } = render(tree('en', serverMessages('en')))
    expectRendered('en')

    rerender(tree('es', serverMessages('es')))
    expectRendered('es')
    expect(screen.getByTestId('instance').textContent).toBe('1')
    expect(mounts).toBe(1)
  })

  test('a local switch is shown immediately, then converges on the refreshed server props', () => {
    const initial = serverMessages('en')
    const { rerender } = render(tree('en', initial))

    switchTo('es')
    expectRendered('es')
    expect(cookieWrites.at(-1)).toStartWith('mercato-locale=es;')
    expect(refreshes).toBe(1)

    // An unrelated rerender with the same server props keeps the optimistic switch.
    rerender(tree('en', initial))
    expectRendered('es')

    rerender(tree('es', serverMessages('es')))
    expectRendered('es')
    expect(mounts).toBe(1)
  })

  test('a refresh that returns the previous locale wins over the optimistic switch', () => {
    const { rerender } = render(tree('en', serverMessages('en')))

    switchTo('es')
    expectRendered('es')

    rerender(tree('en', serverMessages('en')))
    expectRendered('en')
  })

  test('rapid switches keep locale and messages paired', () => {
    const initial = serverMessages('en')
    const { rerender } = render(tree('en', initial))

    switchTo('es')
    expectRendered('es')
    switchTo('en')
    expectRendered('en')
    switchTo('es')
    expectRendered('es')
    expect(refreshes).toBe(3)
    expect(cookieWrites.map((c) => c.split(';')[0])).toEqual([
      'mercato-locale=es',
      'mercato-locale=en',
      'mercato-locale=es',
    ])

    // Refreshes land after the last switch; the final server pair is authoritative.
    rerender(tree('es', serverMessages('es')))
    expectRendered('es')
    switchTo('en')
    expectRendered('en')
    rerender(tree('en', serverMessages('en')))
    expectRendered('en')
    expect(mounts).toBe(1)
  })

  test('server props arriving during navigation supersede a pending switch', () => {
    const { rerender } = render(tree('en', serverMessages('en')))

    switchTo('es')
    rerender(tree('es', serverMessages('es')))
    expectRendered('es')

    // A later server-driven change (e.g. cookie changed in another tab) still applies.
    rerender(tree('en', serverMessages('en')))
    expectRendered('en')
  })

  test('ignores unknown locales', () => {
    render(tree('en', serverMessages('en')))
    act(() => setLocaleRef?.('fr' as Locale))
    expectRendered('en')
    expect(refreshes).toBe(0)
  })
})

describe('I18nProvider translate', () => {
  function Translate({ k, r }: { k: string; r?: Record<string, string | number> }) {
    const { t } = useI18n()
    return <span data-testid="t">{t(k, r)}</span>
  }

  test('interpolates replacements and falls back to the default locale, then the key', () => {
    const partial = {
      ...structuredClone(es),
      nav: { greeting: 'Hola {name}, tienes {count}' },
    } as unknown as Messages

    const { rerender } = render(
      <I18nProvider locale="es" messages={partial}>
        <Translate k="nav.greeting" r={{ name: 'Ana', count: 3 }} />
      </I18nProvider>,
    )
    expect(screen.getByTestId('t').textContent).toBe('Hola Ana, tienes 3')

    rerender(
      <I18nProvider locale="es" messages={partial}>
        <Translate k="nav.main" />
      </I18nProvider>,
    )
    expect(screen.getByTestId('t').textContent).toBe(en.nav.main)

    rerender(
      <I18nProvider locale="es" messages={partial}>
        <Translate k="nav.doesNotExist" />
      </I18nProvider>,
    )
    expect(screen.getByTestId('t').textContent).toBe('nav.doesNotExist')
  })
})
