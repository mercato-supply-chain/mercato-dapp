'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ApproveMilestonePayload } from '@trustless-work/escrow'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Wallet } from 'lucide-react'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

interface DealDeliveryPanelProps {
  deal: Deal
  open: boolean
  milestoneIndex: number | null
  milestoneId: string | null
  isPyme: boolean
  isAdmin: boolean
  isConnected: boolean
  walletAddress: string | undefined
  onOpenChange: (open: boolean) => void
  onConnect: () => void
  signAndSend: (unsignedTransaction: string, address: string) => Promise<void>
  approveMilestone: (
    payload: ApproveMilestonePayload,
    type: string,
  ) => Promise<{ status: string; unsignedTransaction?: string }>
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function DealDeliveryPanel({
  deal,
  open,
  milestoneIndex,
  milestoneId,
  isPyme,
  isAdmin,
  isConnected,
  walletAddress,
  onOpenChange,
  onConnect,
  signAndSend,
  approveMilestone,
  supabase,
  fetchDeal,
  onDealUpdate,
}: DealDeliveryPanelProps) {
  const { t } = useI18n()
  const [proofNotes, setProofNotes] = useState('')
  const [proofDocumentUrl, setProofDocumentUrl] = useState('')
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)

  const handleConfirmDelivery = async () => {
    if (!deal?.escrowAddress || milestoneIndex == null || !milestoneId || !walletAddress) {
      toast.error(t('dealDetail.toastMissingProofWallet'))
      return
    }
    if (!isConnected) {
      toast.error(t('dealDetail.toastConnectWalletDelivery'))
      return
    }
    if (!isPyme && !isAdmin) {
      toast.error(t('dealDetail.toastOnlyPymeOrAdminDelivery'))
      return
    }
    const evidence =
      [proofNotes, proofDocumentUrl].filter(Boolean).join(' | ') ||
      t('dealDetail.evidenceDeliveryDefault')
    setIsSubmittingProof(true)
    try {
      const payload: ApproveMilestonePayload = {
        contractId: deal.escrowAddress,
        milestoneIndex: String(milestoneIndex),
        approver: walletAddress,
      }
      const response = await approveMilestone(payload, 'multi-release')
      if (response.status !== 'SUCCESS' || !response.unsignedTransaction) {
        throw new Error(t('dealDetail.errorApprovalTx'))
      }
      await signAndSend(response.unsignedTransaction, walletAddress)
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          status: 'in_progress',
          proof_notes: evidence || null,
          proof_document_url: proofDocumentUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)
      if (updateError) throw updateError
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success(t('dealDetail.toastDeliveryConfirmed'))
      onOpenChange(false)
      setProofNotes('')
      setProofDocumentUrl('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastConfirmDeliveryFail')
      console.error('Confirm delivery error:', err)
      toast.error(message)
    } finally {
      setIsSubmittingProof(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dealDetail.confirmDeliveryTitle')}</DialogTitle>
          <DialogDescription>{t('dealDetail.confirmDeliveryDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proof-notes">{t('dealDetail.notesOptional')}</Label>
            <Textarea
              id="proof-notes"
              placeholder={t('dealDetail.notesPlaceholder')}
              value={proofNotes}
              onChange={(e) => setProofNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof-url">{t('dealDetail.documentUrlOptional')}</Label>
            <Input
              id="proof-url"
              type="url"
              placeholder={t('dealDetail.proofUrlPlaceholder')}
              value={proofDocumentUrl}
              onChange={(e) => setProofDocumentUrl(e.target.value)}
            />
          </div>
          {!isConnected ? (
            <Button type="button" onClick={onConnect} className="w-full">
              <Wallet className="mr-2 h-4 w-4" aria-hidden />
              {t('dealDetail.connectWalletSign')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={isSubmittingProof}
              className="w-full"
            >
              {isSubmittingProof
                ? t('dealDetail.confirming')
                : t('dealDetail.confirmDeliveryBtn')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
