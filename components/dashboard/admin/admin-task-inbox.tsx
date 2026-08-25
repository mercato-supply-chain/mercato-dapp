import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Info,
  Minus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminTask, AdminTaskPriority } from '@/lib/admin/types'
import type { Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/dictionaries'
import { tr } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<
  AdminTaskPriority,
  { icon: LucideIcon; badgeClass: string }
> = {
  critical: {
    icon: AlertTriangle,
    badgeClass:
      'border-red-300/60 bg-red-500/10 text-red-800 dark:border-red-800/50 dark:text-red-300',
  },
  high: {
    icon: ArrowUpRight,
    badgeClass:
      'border-amber-300/60 bg-amber-500/10 text-amber-800 dark:border-amber-800/50 dark:text-amber-300',
  },
  normal: {
    icon: Minus,
    badgeClass:
      'border-border bg-muted/60 text-foreground/80',
  },
  informational: {
    icon: Info,
    badgeClass:
      'border-border bg-transparent text-muted-foreground',
  },
}

export function formatTaskAge(ageMs: number | null, messages: Messages): string | null {
  if (ageMs == null) return null
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 60) return tr(messages, 'adminOverview.ageMinutes', { count: Math.max(1, minutes) })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return tr(messages, 'adminOverview.ageHours', { count: hours })
  return tr(messages, 'adminOverview.ageDays', { count: Math.floor(hours / 24) })
}

type AdminTaskInboxProps = {
  tasks: AdminTask[]
  messages: Messages
  locale: Locale
  /** Live rows (e.g. indexer disputes) rendered above the derived list. */
  children?: React.ReactNode
}

export function AdminTaskInbox({ tasks, messages: m, children }: AdminTaskInboxProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tr(m, 'adminOverview.inboxTitle')}
          {tasks.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {tasks.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{tr(m, 'adminOverview.inboxDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="font-medium">{tr(m, 'adminOverview.inboxEmptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(m, 'adminOverview.inboxEmptyHint')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {tasks.map((task) => {
              const style = PRIORITY_STYLES[task.priority]
              const PriorityIcon = style.icon
              const age = formatTaskAge(task.ageMs, m)
              return (
                <li key={task.id}>
                  <Link
                    href={task.href}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-nowrap"
                  >
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 gap-1 text-[11px]', style.badgeClass)}
                    >
                      <PriorityIcon className="h-3 w-3" aria-hidden />
                      {tr(m, `adminOverview.priority.${task.priority}`)}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {tr(m, task.titleKey, task.titleParams)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.entityLabel}
                        {' · '}
                        {tr(m, task.stateKey)}
                        {age ? ` · ${age}` : ''}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      {tr(m, task.actionKey)}
                      <ChevronRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
