import { describe, expect, test } from 'bun:test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

const DIRECTORIES = [
  { route: 'investors', dataSymbol: 'InvestorsData', skeletonSymbol: 'InvestorsSkeleton' },
  { route: 'pymes', dataSymbol: 'PymesData', skeletonSymbol: 'PymesSkeleton' },
  { route: 'suppliers', dataSymbol: 'SuppliersData', skeletonSymbol: 'SuppliersSkeleton' },
] as const

const HEADING_KEYS: Record<string, string[]> = {
  investors: ['investorsPage.title', 'investorsPage.subtitle'],
  pymes: ['pymesPage.title', 'pymesPage.subtitle'],
  suppliers: ['suppliersPage.title', 'suppliersPage.description', 'suppliersPage.eyebrow'],
}

function readRouteFile(route: string, file: string): string {
  return readFileSync(join(ROOT, 'app', route, file), 'utf8')
}

describe('public directory routes stream the shell before data', () => {
  for (const { route, dataSymbol, skeletonSymbol } of DIRECTORIES) {
    test(`${route}: page.tsx wraps ${dataSymbol} in Suspense with a skeleton fallback`, () => {
      const page = readRouteFile(route, 'page.tsx')

      expect(page).toContain(`import { Suspense } from 'react'`)
      expect(page).toContain(`import { ${dataSymbol} }`)
      expect(page).toContain(`import { ${skeletonSymbol} }`)
      expect(page).toMatch(new RegExp(`<Suspense fallback={<${skeletonSymbol}\\s*/>}>[\\s\\S]*<${dataSymbol}\\s*/>[\\s\\S]*</Suspense>`))
    })

    test(`${route}: page.tsx renders Navigation and heading synchronously in the shell`, () => {
      const page = readRouteFile(route, 'page.tsx')

      expect(page).toContain(`import { Navigation } from '@/components/navigation'`)
      expect(page).toContain(`<Navigation />`)
      expect(page).toContain(`getServerDictionary`)
      for (const key of HEADING_KEYS[route]) {
        expect(page).toContain(`'${key}'`)
      }
    })

    test(`${route}: loading.tsx exists and mirrors the shell`, () => {
      const path = join(ROOT, 'app', route, 'loading.tsx')
      expect(existsSync(path)).toBe(true)

      const loading = readFileSync(path, 'utf8')
      expect(loading).toContain(`import { Navigation } from '@/components/navigation'`)
      expect(loading).toContain(`import { ${skeletonSymbol} }`)
      expect(loading).toContain('aria-busy')
      expect(loading).toContain(`<Navigation />`)
      for (const key of HEADING_KEYS[route]) {
        expect(loading).toContain(`'${key}'`)
      }
    })

    test(`${route}: data assembly lives in a separate server component (no Navigation)`, () => {
      const dataFile = readRouteFile(route, `${route === 'pymes' ? 'pymes' : route === 'investors' ? 'investors' : 'suppliers'}-data.tsx`)

      expect(dataFile).not.toContain(`'use client'`)
      expect(dataFile).not.toContain(`from '@/components/navigation'`)
      expect(dataFile).toMatch(/export async function/)
    })
  }
})

describe('public directory shells use translated headings in both locales', () => {
  for (const route of Object.keys(HEADING_KEYS)) {
    for (const key of HEADING_KEYS[route]) {
      test(`${route}: ${key} resolves in en and es dictionaries`, async () => {
        const en = (await import('@/messages/en.json')).default as Record<string, Record<string, string>>
        const es = (await import('@/messages/es.json')).default as Record<string, Record<string, string>>
        const [ns, prop] = key.split('.')
        expect(en[ns]?.[prop]).toBeDefined()
        expect(en[ns]?.[prop]?.length).toBeGreaterThan(0)
        expect(es[ns]?.[prop]).toBeDefined()
        expect(es[ns]?.[prop]?.length).toBeGreaterThan(0)
      })
    }
  }
})
