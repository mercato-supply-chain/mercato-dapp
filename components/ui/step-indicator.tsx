import { Check } from 'lucide-react'

export function StepIndicator({
  step,
  current,
  label,
}: {
  step: number
  current: number
  label: string
}) {
  const done = current > step
  const active = current === step

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          done
            ? 'bg-green-600 text-white'
            : active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <span
        className={`text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
    </div>
  )
}
