'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthenticatedViewerFundingNotice } from '@/components/deals/actions/funding-status-notice'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

export interface PymeExtendFundingDialogProps {
  deal: Deal
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  userId: string | null
}

export function PymeExtendFundingDialog({
  deal,
  supabase,
  fetchDeal,
  onDealUpdate,
  userId,
}: PymeExtendFundingDialogProps) {
  const { t } = useI18n()
  const [extendFundingDialogOpen, setExtendFundingDialogOpen] = useState(false)
  const [extendFundingDays, setExtendFundingDays] = useState('7')
  const [isExtendingFundingWindow, setIsExtendingFundingWindow] = useState(false)
  const extendLockRef = useRef(false)

  const handleExtendFundingWindow = async () => {
    if (!deal || !userId || extendLockRef.current) return
    if (deal.pymeId && deal.pymeId !== userId) {
      toast.error(t('dealDetail.toastOnlyPymeExtend'))
      return
    }
    if (deal.fundingStatus !== 'expired' || deal.status !== 'awaiting_funding') {
      toast.error(t('dealDetail.toastExtendNotEligibleDeal'))
      return
    }
    const nextWindowDays = Number(extendFundingDays)
    if (!Number.isInteger(nextWindowDays) || nextWindowDays <= 0) {
      toast.error(t('dealDetail.toastInvalidExtensionDays'))
      return
    }
    extendLockRef.current = true
    setIsExtendingFundingWindow(true)
    try {
      const nowIso = new Date().toISOString()
      const nextExpirationIso = new Date(
        Date.now() + nextWindowDays * 24 * 60 * 60 * 1000,
      ).toISOString()
      const { data, error } = await supabase
        .from('deals')
        .update({
          funding_window_days: nextWindowDays,
          funding_expires_at: nextExpirationIso,
          extension_count: (deal.extensionCount ?? 0) + 1,
          extended_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', deal.id)
        .eq('pyme_id', userId)
        .eq('status', 'seeking_funding')
        .is('investor_id', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) {
        const latest = await fetchDeal()
        if (latest) onDealUpdate(latest)
        throw new Error(t('dealDetail.errorDealIneligibleExtendDb'))
      }
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success(t('dealDetail.toastExtendSuccess'))
      setExtendFundingDialogOpen(false)
      setExtendFundingDays(String(nextWindowDays))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('dealDetail.toastExtendFail')
      console.error('Extend funding window error:', err)
      toast.error(message)
    } finally {
      extendLockRef.current = false
      setIsExtendingFundingWindow(false)
    }
  }

  return (
    <Dialog open={extendFundingDialogOpen} onOpenChange={setExtendFundingDialogOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t('dealDetail.extendFundingCta')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dealDetail.extendTitle')}</DialogTitle>
          <DialogDescription>{t('dealDetail.extendDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="extend-days">{t('dealDetail.additionalDays')}</Label>
            <Input
              id="extend-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={extendFundingDays}
              onChange={(e) => setExtendFundingDays(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={handleExtendFundingWindow}
            disabled={isExtendingFundingWindow}
            className="w-full"
          >
            {isExtendingFundingWindow
              ? t('dealDetail.extending')
              : t('dealDetail.confirmExtension')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export interface PymeFundingActionsProps {
  deal: Deal
  isFundingOpen: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
  userId: string | null
}

export function PymeFundingActions({
  deal,
  isFundingOpen,
  supabase,
  fetchDeal,
  onDealUpdate,
  userId,
}: PymeFundingActionsProps) {
  const { t } = useI18n()

  if (deal.status !== 'awaiting_funding') return null

  if (isFundingOpen) {
    return (
      <AuthenticatedViewerFundingNotice
        deal={deal}
        isFundingOpen={isFundingOpen}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.fundingExpired')}
      </div>
      <PymeExtendFundingDialog
        deal={deal}
        supabase={supabase}
        fetchDeal={fetchDeal}
        onDealUpdate={onDealUpdate}
        userId={userId}
      />
    </div>
  )
}
