'use client'

import * as React from 'react'

/** Reveal children when element enters viewport */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.12, rootMargin = '0px 0px -8% 0px') {
  const ref = React.useRef<T>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold, rootMargin])

  return { ref, visible }
}

/** Subtle parallax on scroll (translateY only, compositor-friendly) */
export function useParallax(speed = 0.08) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [y, setY] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
      setY((progress - 0.5) * speed * 120)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [speed])

  return { ref, style: { transform: `translate3d(0, ${y}px, 0)` } as React.CSSProperties }
}

// Global scheduler for scroll-tracking handlers. Prevents duplicate RAF callbacks and batches updates.
let scrollSchedulerId: ReturnType<typeof requestAnimationFrame> | null = null
const scrollObservers = new Set<() => void>()

function scheduleScrollUpdate(callback: () => void) {
  scrollObservers.add(callback)
  if (scrollSchedulerId !== null) return

  scrollSchedulerId = requestAnimationFrame(() => {
    scrollObservers.forEach((cb) => cb())
    scrollSchedulerId = null
  })
}

function onScrollEvent() {
  if (scrollSchedulerId !== null) {
    cancelAnimationFrame(scrollSchedulerId)
  }
  scrollSchedulerId = requestAnimationFrame(() => {
    scrollObservers.forEach((cb) => cb())
    scrollSchedulerId = null
  })
}

/** Track scroll progress through an element (0–1) with discrete phase updates via callback.
 * Continuous scroll position is stored in a ref to avoid React re-renders on every frame.
 * Phase changes (discrete) trigger the callback, allowing React state updates only when meaningful.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(onPhaseChange?: (phase: number, progress: number) => void) {
  const ref = React.useRef<T>(null)
  const progressRef = React.useRef(0)
  const phaseRef = React.useRef(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      const total = rect.height + window.innerHeight
      const p = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total))
      progressRef.current = p

      // Notify discrete phase changes via callback
      const newPhase = Math.min(6, Math.floor(p * 8))
      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase
        onPhaseChange?.(newPhase, p)
      }
    }

    // Initial measurement
    update()

    const handleScroll = () => scheduleScrollUpdate(update)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollObservers.has(update)) {
        scrollObservers.delete(update)
      }
    }
  }, [onPhaseChange])

  return {
    ref,
    // Expose ref to progress value for direct access in components
    getProgress: () => progressRef.current,
  }
}

// Ensure the scroll listener is attached globally once
const globalState = globalThis as typeof globalThis & {
  __mercato_scroll_listener_attached?: boolean
}
if (typeof window !== 'undefined' && !globalState.__mercato_scroll_listener_attached) {
  window.addEventListener('scroll', onScrollEvent, { passive: true })
  globalState.__mercato_scroll_listener_attached = true
}
