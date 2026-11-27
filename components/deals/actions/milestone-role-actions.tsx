'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ChangeMilestoneStatusPayload } from '@trustless-work/escrow'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import {
  canWalletSignSorobanTx,
  getWalletCapabilityLimitation,
} from '@/lib/mercato-wallet'

type Supabase = ReturnType<typeof createClient>

export function isShipmentMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('shipment')) return true
  if (n.includes('delivery')) return false
  return total === 2 && index === 0
}

export function isDeliveryMilestone(name: string, index: number, total: number): boolean {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('delivery')) return true
  if (n.includes('shipment')) return false
  return total === 2 && index === 1
}

export interface SupplierMilestoneActionProps {
  deal: Deal
  milestone: Deal['milestones'][number]
  index: number
  total: number
  signAndSend: (unsignedTransaction: string, address: string) => Promise<void>
  changeMilestoneStatus: (
    payload: ChangeMilestoneStatusPayload,
    type: string,
  ) => Promise<{ status: string; unsignedTransaction?: string }>
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function SupplierMilestoneAction({
  deal,
  milestone,
  index,
  total,
  signAndSend,
  changeMilestoneStatus,
  supabase,
  fetchDeal,
  onDealUpdate,
}: SupplierMilestoneActionProps) {
  const { t } = useI18n()
  const { walletInfo, isConnected, provider } = useWallet()
  const walletAddress = walletInfo?.address
  const [accepting, setAccepting] = useState(false)
  const acceptingLockRef = useRef(false)
  const canSignSoroban = canWalletSignSorobanTx(provider)
  const capabilityWarning = isConnected ? getWalletCapabilityLimitation(provider) : null

  if (isDeliveryMilestone(milestone.name, index, total)) {
    return (
      <p className="text-xs text-muted-foreground">
        {t('dealDetail.pymeWillConfirmMilestone')}
      </p>
    )
  }

  if (!isShipmentMilestone(milestone.name, index, total)) return null

  const handleAcceptOrder = async () => {
    if (acceptingLockRef.current) return
    if (!deal.escrowAddress || !walletAddress) {
      toast.error(t('dealDetail.toastMissingWallet'))
      return
    }
    if (!isConnected) {
      toast.error(t('dealDetail.toastConnectWalletAccept'))
      return
    }
    if (!canSignSoroban) {
      if (capabilityWarning) toast.error(capabilityWarning)
      return
    }
    acceptingLockRef.current = true
    setAccepting(true)
    try {
      const payload: ChangeMilestoneStatusPayload = {
        contractId: deal.escrowAddress,
        milestoneIndex: String(index),
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
        .eq('id', milestone.id)
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
      acceptingLockRef.current = false
      setAccepting(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        type="button"
        onClick={() => void handleAcceptOrder()}
        disabled={accepting || (isConnected && !canSignSoroban)}
      >
        {accepting ? t('dealDetail.accepting') : t('dealDetail.acceptOrderRelease')}
      </Button>
      {isConnected && !canSignSoroban && capabilityWarning ? (
        <p className="text-xs text-muted-foreground">{capabilityWarning}</p>
      ) : null}
    </div>
  )
}

export interface ConfirmDeliveryMilestoneActionProps {
  milestone: Deal['milestones'][number]
  index: number
  total: number
  variant?: 'default' | 'outline'
  onOpenProofDialog: (index: number, milestoneId: string) => void
}

export function ConfirmDeliveryMilestoneAction({
  milestone,
  index,
  total,
  variant = 'default',
  onOpenProofDialog,
}: ConfirmDeliveryMilestoneActionProps) {
  const { t } = useI18n()

  if (!isDeliveryMilestone(milestone.name, index, total)) return null

  return (
    <Button
      size="sm"
      variant={variant}
      type="button"
      onClick={() => onOpenProofDialog(index, milestone.id)}
    >
      <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
      {t('dealDetail.confirmDeliveryBtn')}
    </Button>
  )
}
