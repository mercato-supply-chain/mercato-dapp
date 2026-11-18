import { beforeEach, describe, expect, test } from 'bun:test'
import {
  applySidebarCollapsedToDocument,
  readSidebarCollapsedFromDocument,
  readSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_ATTRIBUTE,
  SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT,
  SIDEBAR_COLLAPSED_CSS_VAR,
  SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  writeSidebarCollapsedPreference,
} from '@/lib/dashboard/sidebar-preference'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)
  document.documentElement.style.removeProperty(SIDEBAR_COLLAPSED_CSS_VAR)
})

describe('sidebar preference storage', () => {
  test('round-trips the versioned preference', () => {
    expect(writeSidebarCollapsedPreference(true)).toBe(true)
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true')
    expect(readSidebarCollapsedPreference()).toBe(true)

    expect(writeSidebarCollapsedPreference(false)).toBe(true)
    expect(readSidebarCollapsedPreference()).toBe(false)
  })

  test('migrates the legacy v1 key into the versioned key once', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY, 'true')

    expect(readSidebarCollapsedPreference()).toBe(true)
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true')
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_LEGACY_STORAGE_KEY)).toBeNull()
  })

  test('ignores malformed stored values', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'maybe')
    expect(readSidebarCollapsedPreference()).toBeNull()
  })

  test('degrades gracefully when storage access throws', () => {
    const original = window.localStorage
    const blocked = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      },
    } as unknown as Storage

    try {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: blocked })
    } catch {
      return
    }

    try {
      expect(readSidebarCollapsedPreference()).toBeNull()
      expect(writeSidebarCollapsedPreference(true)).toBe(false)
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
    }
  })
})

describe('sidebar preference document mirror', () => {
  test('stamps the attribute and width variable', () => {
    applySidebarCollapsedToDocument(true)
    expect(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)).toBe('true')
    expect(document.documentElement.style.getPropertyValue(SIDEBAR_COLLAPSED_CSS_VAR)).toBe('4rem')
    expect(readSidebarCollapsedFromDocument()).toBe(true)

    applySidebarCollapsedToDocument(false)
    expect(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)).toBe('false')
    expect(document.documentElement.style.getPropertyValue(SIDEBAR_COLLAPSED_CSS_VAR)).toBe('16rem')
    expect(readSidebarCollapsedFromDocument()).toBe(false)
  })
})

describe('pre-hydration bootstrap script', () => {
  test('applies a persisted collapsed preference', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true')

    new Function(SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT)()

    expect(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)).toBe('true')
    expect(document.documentElement.style.getPropertyValue(SIDEBAR_COLLAPSED_CSS_VAR)).toBe('4rem')
  })

  test('falls back to expanded when nothing is stored', () => {
    new Function(SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT)()

    expect(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)).toBe('false')
    expect(document.documentElement.style.getPropertyValue(SIDEBAR_COLLAPSED_CSS_VAR)).toBe('16rem')
  })

  test('never throws when storage access throws', () => {
    const original = window.localStorage
    const blocked = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      },
    } as unknown as Storage

    try {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: blocked })
    } catch {
      return
    }

    try {
      expect(() => new Function(SIDEBAR_COLLAPSED_BOOTSTRAP_SCRIPT)()).not.toThrow()
      expect(document.documentElement.getAttribute(SIDEBAR_COLLAPSED_ATTRIBUTE)).toBe('false')
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
    }
  })
})
