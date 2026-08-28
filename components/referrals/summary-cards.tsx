import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReferralSummaryMetrics } from '@/lib/referrals/get-supplier-referral-dashboard'

type Labels = {
  acquisitionTitle: string
  financingTitle: string
  invitationsCreated: string
  validInvitations: string
  linkOpens: string
  accountsCreated: string
  onboardedPymes: string
  conversionRate: string
  referredPymes: string
  activeReferred: string
  requestedVolume: string
  fundedVolume: string
}

type Props = {
  summary: ReferralSummaryMetrics
  labels: Labels
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function ReferralSummaryCards({ summary, labels }: Props) {
  const conversionPct = `${(summary.conversionRate * 100).toFixed(1)}%`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.acquisitionTitle}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label={labels.invitationsCreated} value={summary.invitationsCreated} />
          <Metric label={labels.validInvitations} value={summary.validInvitations} />
          <Metric label={labels.linkOpens} value={summary.linkOpens} />
          <Metric label={labels.accountsCreated} value={summary.accountsCreated} />
          <Metric label={labels.onboardedPymes} value={summary.onboardedPymes} />
          <Metric label={labels.conversionRate} value={conversionPct} />
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.financingTitle}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={labels.referredPymes} value={summary.referredPymes} />
          <Metric label={labels.activeReferred} value={summary.activeReferredPymes} />
          <Metric label={labels.requestedVolume} value={formatUsd(summary.requestedVolume)} />
          <Metric label={labels.fundedVolume} value={formatUsd(summary.fundedVolume)} />
        </div>
      </div>
    </div>
  )
}
