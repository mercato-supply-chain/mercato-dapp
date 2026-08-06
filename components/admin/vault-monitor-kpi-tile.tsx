import { cn } from '@/lib/utils'

export function KpiTile({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card p-4 shadow-sm',
        highlight && 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}
