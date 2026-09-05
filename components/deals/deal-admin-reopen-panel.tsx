'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import type { Deal } from '@/lib/types'
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
import { useAdminReopenDeal } from '@/hooks/use-admin-reopen-deal'
import { useI18n } from '@/lib/i18n/provider'
import { formatDate } from '@/lib/date-utils'

type DealAdminReopenPanelProps = {
  deal: Deal
  isAdmin: boolean
  onReopened?: () => void | Promise<void>
  /** When true, renders the trigger button inline without dialog wrapper styling */
  inline?: boolean
}

export function DealAdminReopenPanel({
  deal,
  isAdmin,
  onReopened,
  inline = false,
}: DealAdminReopenPanelProps) {
  const { t } = useI18n()
  const { submit, isSubmitting } = useAdminReopenDeal()
  const [open, setOpen] = useState(false)
  const [fundingWindowDays, setFundingWindowDays] = useState(
    String(deal.fundingWindowDays ?? 7),
  )

  const canReopen =
    isAdmin &&
    deal.status === 'awaiting_funding' &&
    deal.fundingStatus === 'expired'

  const nextExpirationPreview = useMemo(() => {
    const days = Number(fundingWindowDays)
    if (!Number.isInteger(days) || days <= 0) return null
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }, [fundingWindowDays])

  if (!canReopen) return null

  const handleReopen = async () => {
    const days = Number(fundingWindowDays)
    if (!Number.isInteger(days) || days <= 0) {
      toast.error(t('dealDetail.adminReopenInvalidDays'))
      return
    }

    const result = await submit({ dealId: deal.id, fundingWindowDays: days })
    if (!result.ok) {
      toast.error(result.error || t('dealDetail.adminReopenFail'))
      return
    }

    toast.success(t('dealDetail.adminReopenSuccess'))
    setOpen(false)
    await onReopened?.()
  }

  const dialogBody = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t('dealDetail.adminReopenTitle')}</DialogTitle>
        <DialogDescription>{t('dealDetail.adminReopenDescription')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-reopen-days">{t('dealDetail.fundingWindowLabel')}</Label>
          <Input
            id="admin-reopen-days"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={fundingWindowDays}
            onChange={(e) => setFundingWindowDays(e.target.value)}
          />
        </div>
        {nextExpirationPreview ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.adminReopenExpiresPreview', {
              date: formatDate(nextExpirationPreview.toISOString()),
            })}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" asChild>
            <Link href={`/deals/${deal.id}/edit`}>{t('dealDetail.adminReopenEditTerms')}</Link>
          </Button>
          <Button type="button" onClick={handleReopen} disabled={isSubmitting}>
            {isSubmitting ? t('dealDetail.adminReopenSubmitting') : t('dealDetail.adminReopenConfirm')}
          </Button>
        </div>
      </div>
    </DialogContent>
  )

  if (inline) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="default" className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('dealDetail.adminReopenCta')}
          </Button>
        </DialogTrigger>
        {dialogBody}
      </Dialog>
    )
  }

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="default" className="gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('dealDetail.adminReopenCta')}
          </Button>
        </DialogTrigger>
        {dialogBody}
      </Dialog>
    </div>
  )
}
