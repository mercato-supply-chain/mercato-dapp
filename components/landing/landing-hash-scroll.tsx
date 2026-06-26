'use client'

import { useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const NAV_HEIGHT = 64

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return

  let attempts = 0
  const maxAttempts = 10
  const tryScroll = () => {
    attempts++
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Check if scroll reached the target (within a tolerance for the nav offset).
    // If the body is still scroll-locked (e.g. mobile sheet closing) the element
    // stays far below the viewport — retry after the lock releases.
    requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top
      if (top > NAV_HEIGHT * 2.5 && attempts < maxAttempts) {
        setTimeout(tryScroll, 80)
      }
    })
  }
  // Initial delay lets a closing overlay or page render settle.
  setTimeout(tryScroll, 50)
}

/** Scroll to `#section` on the homepage after hash changes or cross-page navigation. */
export function LandingHashScroll() {
  const pathname = usePathname()

  const scrollToHash = useCallback(() => {
    const hash = window.location.hash
    if (!hash) return
    scrollToId(hash.replace('#', ''))
  }, [])

  useEffect(() => {
    if (pathname !== '/') return
    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [pathname, scrollToHash])

  return null
}
