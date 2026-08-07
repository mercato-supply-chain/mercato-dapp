import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type VerifiedBadgeProps = {
  /** Badge text and fallback screen-reader label */
  label?: string
  /** Hover tooltip (defaults to label) */
  tooltip?: string
  /** `icon` — blue check next to a name; `badge` — pill with label */
  variant?: 'icon' | 'badge'
  className?: string
}

export function VerifiedBadge({
  label = 'Verified',
  tooltip,
  variant = 'icon',
  className,
}: VerifiedBadgeProps) {
  const title = tooltip ?? label

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 ring-1 ring-blue-500/25 dark:text-blue-400',
          className,
        )}
        title={title}
      >
        <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-blue-500 text-white dark:fill-blue-400" aria-hidden />
        <span>{label}</span>
      </span>
    )
  }

  return (
    <span className={cn('inline-flex shrink-0', className)} title={title} aria-label={title}>
      <BadgeCheck
        className="h-4 w-4 fill-blue-500 text-white dark:fill-blue-400 dark:text-background"
        aria-hidden
      />
    </span>
  )
}
