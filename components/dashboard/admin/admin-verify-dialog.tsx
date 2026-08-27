'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BadgeCheck, ShieldOff } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n/provider'

type AdminVerifyDialogProps = {
  entityType: 'profile' | 'supplier_company'
  entityId: string
  entityName: string
  verified: boolean
}

/**
 * Confirmed verify/unverify action. The server route + RPC re-check the admin
 * role and write the audit event; this dialog only collects the confirmation
 * and optional reason.
 */
export function AdminVerifyDialog({
  entityType,
  entityId,
  entityName,
  verified,
}: AdminVerifyDialogProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const nextVerified = !verified

  async function onConfirm() {
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          verified: nextVerified,
          reason: reason.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error || 'Request failed')
      }
      toast.success(
        t(nextVerified ? 'adminUsers.verifySuccess' : 'adminUsers.unverifySuccess', {
          name: entityName,
        }),
      )
      setOpen(false)
      setReason('')
      router.refresh()
    } catch {
      toast.error(t('adminUsers.verifyError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={nextVerified ? 'default' : 'outline'} size="sm" className="gap-1.5">
          {nextVerified ? (
            <BadgeCheck className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldOff className="h-4 w-4" aria-hidden />
          )}
          {t(nextVerified ? 'adminUsers.verifyAction' : 'adminUsers.unverifyAction')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(
              nextVerified
                ? 'adminUsers.verifyConfirmTitle'
                : 'adminUsers.unverifyConfirmTitle',
              { name: entityName },
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('adminUsers.verifyConfirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`verify-reason-${entityId}`}>
            {t('adminUsers.verifyReasonLabel')}
          </Label>
          <Textarea
            id={`verify-reason-${entityId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('adminUsers.verifyReasonPlaceholder')}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>
            {t('adminUsers.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
            disabled={submitting}
          >
            {submitting
              ? t('adminUsers.saving')
              : t(nextVerified ? 'adminUsers.verifyAction' : 'adminUsers.unverifyAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
