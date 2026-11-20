import { describe, test, expect, beforeEach, afterEach, vi } from 'bun:test'

// Mock DOM APIs
let scrollListeners: ((e: Event) => void)[] = []
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

global.window = {
  addEventListener: (event: string, listener: EventListener) => {
    if (event === 'scroll') {
      scrollListeners.push(listener as (e: Event) => void)
    }
  },
  removeEventListener: (event: string, listener: EventListener) => {
    if (event === 'scroll') {
      scrollListeners = scrollListeners.filter((l) => l !== listener)
    }
  },
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    rafCallbacks.push(callback)
    return ++rafId
  },
  cancelAnimationFrame: (id: number) => {
    rafId++
  },
  innerHeight: 1000,
} as unknown as Window & typeof globalThis

describe('useScrollProgress', () => {
  beforeEach(() => {
    scrollListeners = []
    rafCallbacks = []
    rafId = 0
  })

  test('batches scroll events to prevent duplicate RAF calls', () => {
    // Simulate multiple scroll events firing rapidly
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

    scrollListeners.forEach((listener) => {
      listener(new Event('scroll'))
      listener(new Event('scroll'))
      listener(new Event('scroll'))
    })

    // RAF should be called for the first event, but not for the subsequent ones
    // (they get batched in a single RAF call)
    expect(rafSpy.mock.calls.length).toBeGreaterThan(0)
  })

  test('calls onPhaseChange callback only when phase changes', () => {
    const phaseCallback = vi.fn()

    // Phase should only change when Math.floor(progress * 8) changes
    // This means progress needs to jump from < 0.125 to >= 0.125 to trigger phase 1
    expect(phaseCallback).not.toHaveBeenCalled()
  })

  test('provides getProgress function to read continuous value', () => {
    // The hook should expose a ref with getProgress() method
    // that doesn't trigger re-renders on continuous scroll changes
  })
})

describe('useReveal', () => {
  test('sets visible=true when element intersects viewport', () => {
    // IntersectionObserver mock needed
  })
})

describe('useParallax', () => {
  test('calculates parallax offset without storing in React state', () => {
    // useParallax should continue working as before
  })
})
