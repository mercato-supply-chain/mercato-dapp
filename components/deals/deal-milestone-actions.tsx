'use client'

import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2 } from 'lucide-react'
import type { Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'
import { isShipmentMilestone } from '@/components/deals/actions/milestone-role-actions'

export interface DealMilestoneActionsProps {
  deal: Deal
  /** Composed role-specific action renderer for pending milestones. */
  renderMilestoneAction?: (
    milestone: Deal['milestones'][number],
    index: number,
    total: number,
  ) => ReactNode
}

export function DealMilestoneActions({
  deal,
  renderMilestoneAction,
}: DealMilestoneActionsProps) {
  const { t } = useI18n()

  const completedMilestones = deal.milestones.filter((m) => m.status === 'completed').length
  const progressPercentage =
    deal.milestones.length > 0 ? (completedMilestones / deal.milestones.length) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('dealDetail.milestonesTitle')}</CardTitle>
            <CardDescription className="mt-1">
              {t('dealDetail.milestonesSubtitle')}
            </CardDescription>
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
            {t('dealDetail.completedProgressMilestones', {
              completed: completedMilestones,
              total: deal.milestones.length,
            })}
          </span>
        </div>
        <Progress value={progressPercentage} className="mt-4 h-1.5" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deal.milestones.map((milestone, index) => {
            const milestoneAmount = (deal.priceUSDC * milestone.percentage) / 100
            const isDone = milestone.status === 'completed'
            const isActive = milestone.status === 'in_progress'
            const isDisputed = milestone.status === 'disputed'
            const total = deal.milestones.length
            const pendingAction =
              milestone.status === 'pending' &&
              deal.status !== 'awaiting_funding' &&
              deal.escrowAddress &&
              renderMilestoneAction
                ? renderMilestoneAction(milestone, index, total)
                : null

            return (
              <div
                key={milestone.id}
                className={`rounded-xl border-2 p-4 transition-colors ${
                  isDone
                    ? 'border-success/30 bg-success/5'
                    : isDisputed
                      ? 'border-destructive/30 bg-destructive/5'
                      : isActive
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isDone
                        ? 'bg-success text-success-foreground'
                        : isDisputed
                          ? 'bg-destructive text-destructive-foreground'
                          : isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{milestone.name}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isDone
                            ? 'bg-success/10 text-success'
                            : isActive
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {milestone.percentage}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                      <span className="font-medium tabular-nums">
                        {formatCurrency(milestoneAmount)} USDC
                      </span>
                      {isDone && milestone.completedAt && (
                        <span className="text-muted-foreground">
                          {t('dealDetail.completedOn', {
                            date: formatDate(milestone.completedAt),
                          })}
                        </span>
                      )}
                      {isActive && (
                        <span className="text-primary">
                          {isShipmentMilestone(milestone.name, index, total)
                            ? t('dealDetail.releaseAwaitingAdmin')
                            : t('dealDetail.deliveryAwaitingAdmin')}
                        </span>
                      )}
                    </div>

                    {milestone.proofNotes && !isDone && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {milestone.proofNotes}
                      </p>
                    )}

                    {pendingAction ? <div className="mt-3">{pendingAction}</div> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
