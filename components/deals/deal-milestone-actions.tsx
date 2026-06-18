'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ChangeMilestoneStatusPayload } from '@trustless-work/escrow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2 } from 'lucide-react'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

function isShipmentMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('shipment')) return true
  if (n.includes('delivery')) return false
  return total === 2 && index === 0
}

function isDeliveryMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('delivery')) return true
  if (n.includes('shipment')) return false
  return total === 2 && index === 1
}

interface DealMilestoneActionsProps {
  deal: Deal
  isSupplier: boolean
  isPyme: boolean
  isAdmin: boolean
  isConnected: boolean
  walletAddress: string | undefined
  signAndSend: (unsignedTransaction: string, address: string) => Promise<void>
  changeMilestoneStatus: (
    payload: ChangeMilestoneStatusPayload,
    type: string,
  ) => Promise<{ status: string; unsignedTransaction?: string }>
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  onOpenProofDialog: (index: number, milestoneId: string) => void
}

export function DealMilestoneActions({
  deal,
  isSupplier,
  isPyme,
  isAdmin,
  isConnected,
  walletAddress,
  signAndSend,
  changeMilestoneStatus,
  supabase,
  fetchDeal,
  onDealUpdate,
  onOpenProofDialog,
}: DealMilestoneActionsProps) {
  const { t } = useI18n()
  const [acceptingMilestoneId, setAcceptingMilestoneId] = useState<string | null>(null)

  const completedMilestones = deal.milestones.filter((m) => m.status === 'completed').length
  const progressPercentage = (completedMilestones / deal.milestones.length) * 100

  const handleAcceptOrder = async (milestoneIndex: number, milestoneId: string) => {
    if (!deal.escrowAddress || !walletAddress) {
      toast.error(t('dealDetail.toastMissingWallet'))
      return
    }
    if (!isConnected) {
      toast.error(t('dealDetail.toastConnectWalletAccept'))
      return
    }
    setAcceptingMilestoneId(milestoneId)
    try {
      const payload: ChangeMilestoneStatusPayload = {
        contractId: deal.escrowAddress,
        milestoneIndex: String(milestoneIndex),
        newStatus: 'release_requested',
        newEvidence: 'Order accepted by supplier',
        serviceProvider: walletAddress,
      }
      const response = await changeMilestoneStatus(payload, 'multi-release')
      if (response.status !== 'SUCCESS' || !response.unsignedTransaction) {
        throw new Error(t('dealDetail.errorMilestoneStatusTx'))
      }
      await signAndSend(response.unsignedTransaction, walletAddress)
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          status: 'in_progress',
          proof_notes: 'Order accepted by supplier',
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)
      if (updateError) throw updateError
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success(t('dealDetail.toastOrderAccepted'))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastAcceptOrderFail')
      console.error('Accept order error:', err)
      toast.error(message)
    } finally {
      setAcceptingMilestoneId(null)
    }
  }

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

                    {milestone.status === 'pending' &&
                      deal.status !== 'awaiting_funding' &&
                      deal.escrowAddress && (
                        <div className="mt-3">
                          {isDeliveryMilestone(milestone.name, index, total) && isSupplier && (
                            <p className="text-xs text-muted-foreground">
                              {t('dealDetail.pymeWillConfirmMilestone')}
                            </p>
                          )}
                          {isShipmentMilestone(milestone.name, index, total) && isSupplier && (
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => handleAcceptOrder(index, milestone.id)}
                              disabled={acceptingMilestoneId === milestone.id}
                            >
                              {acceptingMilestoneId === milestone.id
                                ? t('dealDetail.accepting')
                                : t('dealDetail.acceptOrderRelease')}
                            </Button>
                          )}
                          {isDeliveryMilestone(milestone.name, index, total) &&
                            (isPyme || isAdmin) && (
                              <Button
                                size="sm"
                                variant={isPyme ? 'default' : 'outline'}
                                type="button"
                                onClick={() => onOpenProofDialog(index, milestone.id)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                                {t('dealDetail.confirmDeliveryBtn')}
                              </Button>
                            )}
                        </div>
                      )}
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
