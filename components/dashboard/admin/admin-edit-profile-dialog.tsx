'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/lib/i18n/provider'

/** Whitelisted public-profile fields the server accepts (see PATCH route). */
const EDITABLE_FIELDS = [
  'full_name',
  'contact_name',
  'company_name',
  'phone',
  'country',
  'sector',
  'website',
] as const

type EditableField = (typeof EDITABLE_FIELDS)[number]

const FIELD_LABEL_KEYS: Record<EditableField, string> = {
  full_name: 'adminUsers.fields.fullName',
  contact_name: 'adminUsers.fields.contactName',
  company_name: 'adminUsers.fields.companyName',
  phone: 'adminUsers.fields.phone',
  country: 'adminUsers.fields.country',
  sector: 'adminUsers.fields.sector',
  website: 'adminUsers.fields.website',
}

type AdminEditProfileDialogProps = {
  profileId: string
  profileName: string
  initialValues: Partial<Record<EditableField, string | null>> & { bio?: string | null }
}

/** Admin correction of public-profile fields, with reason and audit trail. */
export function AdminEditProfileDialog({
  profileId,
  profileName,
  initialValues,
}: AdminEditProfileDialogProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(
      EDITABLE_FIELDS.map((field) => [field, initialValues[field] ?? '']),
    ),
    bio: initialValues.bio ?? '',
  }))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const changed: Record<string, string> = {}
    for (const field of [...EDITABLE_FIELDS, 'bio'] as const) {
      const initial = (field === 'bio' ? initialValues.bio : initialValues[field]) ?? ''
      if (values[field] !== initial) changed[field] = values[field]
    }
    if (Object.keys(changed).length === 0) {
      setOpen(false)
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/users/${profileId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: changed, reason: reason.trim() || undefined }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error || 'Request failed')
      }
      toast.success(t('adminUsers.editSuccess', { name: profileName }))
      setOpen(false)
      setReason('')
      router.refresh()
    } catch {
      toast.error(t('adminUsers.editError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-4 w-4" aria-hidden />
          {t('adminUsers.editAction')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('adminUsers.editTitle', { name: profileName })}</DialogTitle>
          <DialogDescription>{t('adminUsers.editDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {EDITABLE_FIELDS.map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`edit-${field}`}>{t(FIELD_LABEL_KEYS[field])}</Label>
                <Input
                  id={`edit-${field}`}
                  value={values[field]}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-bio">{t('adminUsers.fields.bio')}</Label>
            <Textarea
              id="edit-bio"
              value={values.bio}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, bio: event.target.value }))
              }
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-reason">{t('adminUsers.verifyReasonLabel')}</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('adminUsers.verifyReasonPlaceholder')}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {t('adminUsers.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('adminUsers.saving') : t('adminUsers.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
