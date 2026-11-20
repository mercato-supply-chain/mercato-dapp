import { describe, expect, test } from 'bun:test'
import { lookup, interpolate, translate, scopedMessages } from '@/lib/i18n/messages'
import { enDict, getDictionary } from '@/lib/i18n/dictionaries'

describe('i18n pure message helpers', () => {
  test('lookup resolves nested string keys', () => {
    expect(lookup(enDict, 'landing.hero.titleLine1')).toBe('Capital to produce.')
  })

  test('lookup returns undefined for missing keys', () => {
    expect(lookup(enDict, 'nonexistent.key')).toBeUndefined()
  })

  test('lookup returns undefined for non-string leaves', () => {
    expect(lookup(enDict, 'landing.hero')).toBeUndefined()
  })

  test('interpolate replaces placeholders', () => {
    expect(interpolate('Hello {name}', { name: 'Alice' })).toBe('Hello Alice')
  })

  test('interpolate leaves the value untouched without replacements', () => {
    expect(interpolate('Hello {name}')).toBe('Hello {name}')
  })

  test('translate prefers the active dictionary', () => {
    const active: Record<string, unknown> = { greeting: 'Hola {name}' }
    const fallback: Record<string, unknown> = { greeting: 'Hello {name}' }
    expect(translate(active, fallback, 'greeting', { name: 'Ana' })).toBe('Hola Ana')
  })

  test('translate falls back to the fallback dictionary when the key is missing', () => {
    const active: Record<string, unknown> = {}
    const fallback: Record<string, unknown> = { greeting: 'Hello {name}' }
    expect(translate(active, fallback, 'greeting', { name: 'Ana' })).toBe('Hello Ana')
  })

  test('translate falls back to the raw key when neither dictionary has it', () => {
    const active: Record<string, unknown> = {}
    const fallback: Record<string, unknown> = {}
    expect(translate(active, fallback, 'missing.key')).toBe('missing.key')
  })

  test('scopedMessages returns the namespace subtree', () => {
    const scoped = scopedMessages(enDict, 'landing')
    expect(typeof scoped).toBe('object')
    expect((scoped.hero as Record<string, unknown>).titleLine1).toBe('Capital to produce.')
  })

  test('scopedMessages returns an empty object for an unknown namespace', () => {
    expect(scopedMessages(enDict, 'nopeNotHere')).toEqual({})
  })
})

describe('i18n dictionary loading', () => {
  test('English resolves to the statically imported dictionary', async () => {
    const dict = await getDictionary('en')
    expect(dict).toBe(enDict)
  })

  test('unknown locales fall back to English', async () => {
    const dict = await getDictionary('zz')
    expect(dict).toBe(enDict)
  })

  test('Spanish loads lazily and is cached across calls', async () => {
    const first = await getDictionary('es')
    const second = await getDictionary('es')
    expect(first).toBe(second)
    expect(first).not.toBe(enDict)
    expect(typeof first.landing).toBe('object')
  })

  test('Spanish mirrors the English key set', async () => {
    const es = await getDictionary('es')
    const enLeaves: string[] = []
    const esLeaves: string[] = []

    const collect = (node: unknown, path: string[], out: string[]) => {
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const next = [...path, key]
        if (typeof value === 'string') out.push(next.join('.'))
        else collect(value, next, out)
      }
    }

    collect(enDict, [], enLeaves)
    collect(es, [], esLeaves)

    expect(esLeaves.length).toBe(enLeaves.length)
    expect(esLeaves.sort()).toEqual(enLeaves.sort())
  })
})
