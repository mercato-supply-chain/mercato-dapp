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

/** Track scroll progress through an element (0–1) */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T>(null)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const total = rect.height + window.innerHeight
      const p = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total))
      setProgress(p)
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
  }, [])

  return { ref, progress }
}
