import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import { cn } from '@/lib/utils'

export type DashboardAction = {
  label: string
  description: string
  href: string
  icon: LucideIcon
  primary?: boolean
}

type DashboardActionGridProps = {
  userType: string
  title: string
  actions: DashboardAction[]
}

export function DashboardActionGrid({ userType, title, actions }: DashboardActionGridProps) {
  const theme = getRoleTheme(userType)

  return (
    <div>
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => {
          const isPrimary = action.primary ?? index === 0
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300',
                'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isPrimary ? theme.actionPrimary : 'border-border/70 bg-card hover:border-border',
                isPrimary && 'sm:col-span-2',
              )}
            >
              <div>
                <div
                  className={cn(
                    'mb-4 flex h-10 w-10 items-center justify-center rounded-xl',
                    isPrimary ? 'bg-brand-mid text-white dark:bg-brand-mid' : 'bg-muted',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-base font-semibold leading-snug text-foreground">{action.label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{action.description}</p>
              </div>
              <span
                className={cn(
                  'mt-5 inline-flex items-center gap-1 text-sm font-medium',
                  isPrimary ? theme.accent : 'text-muted-foreground group-hover:text-foreground',
                )}
              >
                Open
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
