import { cn } from '@/lib/utils'

export type OwnershipStatProps = {
  label: string
  value: string
  sublabel: string
  accent?: 'emerald'
}

export function OwnershipStat({
  label,
  value,
  sublabel,
  accent,
}: OwnershipStatProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-muted/20 px-4 py-3',
        accent === 'emerald' && 'border-emerald-500/20 bg-emerald-500/5',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
    </div>
  )
}
