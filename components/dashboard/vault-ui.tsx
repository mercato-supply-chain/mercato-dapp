import Image from 'next/image'
import { cn } from '@/lib/utils'

const TOKEN_COLORS: Record<string, string> = {
  USDC: 'bg-[#2775CA] text-white ring-[#2775CA]/30',
  EURC: 'bg-indigo-600 text-white ring-indigo-600/30',
  XLM: 'bg-zinc-700 text-white ring-zinc-700/30',
}

export function TokenAvatar({
  symbol,
  size = 'md',
  className,
}: {
  symbol: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const palette =
    TOKEN_COLORS[symbol.toUpperCase()] ??
    'bg-emerald-600 text-white ring-emerald-600/30 dark:bg-emerald-500'

  const sizes = {
    sm: 'h-7 w-7 text-[10px] ring-2',
    md: 'h-9 w-9 text-xs ring-2',
    lg: 'h-11 w-11 text-sm ring-[3px]',
    xl: 'h-14 w-14 text-base ring-[3px]',
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold shadow-sm',
        palette,
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {symbol.slice(0, 1)}
    </div>
  )
}

export function VaultSectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

export function DefindexMark({ className }: { className?: string }) {
  return (
    <Image
      src="/defindex-logo.svg"
      alt=""
      width={88}
      height={24}
      className={cn('h-4 w-auto max-w-[5.5rem] shrink-0 opacity-80 sm:h-[18px]', className)}
      aria-hidden
    />
  )
}

/** Readable partner badge for cards (works in light + dark). */
export function DefindexPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm',
        className,
      )}
    >
      <Image
        src="/defindex-logo.svg"
        alt=""
        width={72}
        height={20}
        className="h-3.5 w-auto shrink-0 dark:brightness-[1.75]"
        aria-hidden
      />
      <span className="text-muted-foreground">DeFindex</span>
    </span>
  )
}

export function StellarMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm',
        className,
      )}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 text-[7px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
        S
      </span>
      <span className="text-muted-foreground">Stellar</span>
    </span>
  )
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}
