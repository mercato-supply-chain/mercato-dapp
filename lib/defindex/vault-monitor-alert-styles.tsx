import { AlertTriangle, ShieldAlert, XCircle } from 'lucide-react'
import type { VaultMonitorAlertSeverity } from '@/lib/defindex/vault-monitor'

export function alertStyles(severity: VaultMonitorAlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-red-500/40 bg-red-500/5 text-red-900 dark:text-red-200'
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200'
    default:
      return 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200'
  }
}

export function alertIcon(severity: VaultMonitorAlertSeverity) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 shrink-0" aria-hidden />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
    default:
      return <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
  }
}
