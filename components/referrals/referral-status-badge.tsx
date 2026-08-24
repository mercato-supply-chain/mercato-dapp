import { Badge } from '@/components/ui/badge'
import type { ReferredPymeStatus } from '@/lib/referrals/referred-pyme-status'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<ReferredPymeStatus, string> = {
  invited: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  account_created: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  onboarding_incomplete: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  inactive: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

type Props = {
  status: ReferredPymeStatus
  label: string
  className?: string
}

export function ReferralStatusBadge({ status, label, className }: Props) {
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', STATUS_CLASS[status], className)}>
      {label}
    </Badge>
  )
}
