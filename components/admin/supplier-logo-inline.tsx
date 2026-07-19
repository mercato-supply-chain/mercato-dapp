'use client'

import { useState } from 'react'
import type { User } from 'lucide-react'

interface SupplierLogoInlineProps {
  logoUrl: string | null
  /** Accessible alt text for the logo image (e.g. the company name). */
  alt: string
  /**
   * When provided, the logo box is always rendered and this icon is shown
   * whenever the image is missing or fails to load.
   * When omitted, the component renders nothing in that case.
   */
  fallbackIcon?: typeof User
  /**
   * When provided, the logo box is wrapped in a row alongside this text label
   * (used by the release-funds fallback panel).
   */
  label?: string
  /** Extra classes for the logo box, to preserve per-screen styling. */
  boxClassName?: string
}

/**
 * Small inline supplier logo used across admin panels.
 *
 * Consolidates the previous `SupplierLogoPending` / `SupplierLogoFallback`
 * pair: pass `fallbackIcon` for the always-visible icon-fallback behavior,
 * or `label` for the hide-when-missing labeled row behavior.
 */
export function SupplierLogoInline({
  logoUrl,
  alt,
  fallbackIcon: Icon,
  label,
  boxClassName = '',
}: SupplierLogoInlineProps) {
  const [imageError, setImageError] = useState(false)

  const showImage = Boolean(logoUrl) && !imageError

  // Without a fallback icon, there is nothing to render when the image
  // is unavailable (previous SupplierLogoFallback behavior).
  if (!showImage && !Icon) return null

  const box = (
    <div
      className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 ${boxClassName}`}
    >
      {showImage ? (
        <img
          src={logoUrl as string}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        Icon && <Icon className="h-3 w-3" aria-hidden />
      )}
    </div>
  )

  if (label) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {box}
        <span>{label}</span>
      </div>
    )
  }

  return box
}
