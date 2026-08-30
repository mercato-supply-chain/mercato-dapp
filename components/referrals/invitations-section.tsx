'use client'

import { useState } from 'react'
import { Copy, Check, Loader2, Plus, RefreshCw, Ban } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReferralInvitationView } from '@/lib/referrals/get-supplier-referral-dashboard'
import { toast } from 'sonner'

type Company = { id: string; company_name: string | null }

type Labels = {
  title: string
  empty: string
  company: string
  label: string
  recipient: string
  status: string
  opens: string
  created: string
  create: string
  createTitle: string
  createDescription: string
  labelPlaceholder: string
  emailPlaceholder: string
  copyLink: string
  copied: string
  revoke: string
  regenerate: string
  confirmRevoke: string
  directReferral: string
  statusLabels: Record<string, string>
}

type Props = {
  invitations: ReferralInvitationView[]
  companies: Company[]
  labels: Labels
  page: number
  total: number
  pageSize: number
  baseQuery: string
}

export function ReferralInvitationsSection({
  invitations,
  companies,
  labels,
  page,
  total,
  pageSize,
  baseQuery,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreate = async () => {
    if (!companyId) return
    setCreating(true)
    try {
      const res = await fetch('/api/referral/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierCompanyId: companyId,
          label: label.trim() || undefined,
          recipientEmail: recipientEmail.trim() || undefined,
        }),
      })
      const raw = await res.text()
      let data: { error?: string; inviteUrl?: string; id?: string } = {}
      if (raw.trim()) {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('invalid')
          }
          data = parsed as typeof data
        } catch {
          throw new Error('Something went wrong. Please try again.')
        }
      }
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && data.error.length > 0 && data.error.length < 120
            ? data.error
            : 'Could not create invitation. Please try again.',
        )
      }
      if (typeof data.inviteUrl !== 'string' || !data.inviteUrl) {
        throw new Error('Could not create invitation. Please try again.')
      }
      setInviteUrl(data.inviteUrl)
      toast.success(labels.create)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create invitation. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm(labels.confirmRevoke)) return
    setLoadingId(id)
    try {
      const res = await fetch(`/api/referral/invitations/${id}/revoke`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      window.location.reload()
    } catch {
      toast.error('Could not revoke invitation')
    } finally {
      setLoadingId(null)
    }
  }

  const handleRegenerate = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/referral/invitations/${id}/regenerate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      await copyUrl(data.inviteUrl)
      toast.success(labels.copied)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoadingId(null)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              {labels.create}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{labels.createTitle}</DialogTitle>
              <DialogDescription>{labels.createDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{labels.company}</Label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-10 w-full appearance-none rounded-md border border-input bg-background bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-10 text-sm"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  }}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name ?? c.id}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{labels.label}</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={labels.labelPlaceholder} />
              </div>
              <div className="space-y-2">
                <Label>{labels.recipient}</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={labels.emailPlaceholder}
                />
              </div>
              {inviteUrl && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="truncate">{inviteUrl}</p>
                  <Button type="button" size="sm" variant="ghost" className="mt-2 gap-1" onClick={() => copyUrl(inviteUrl)}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? labels.copied : labels.copyLink}
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || !companyId}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : labels.create}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.company}</TableHead>
              <TableHead>{labels.label}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.opens}</TableHead>
              <TableHead>{labels.created}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.companyName ?? inv.supplierCompanyId}</TableCell>
                <TableCell>{inv.label ?? '—'}</TableCell>
                <TableCell>{labels.statusLabels[inv.status] ?? inv.status}</TableCell>
                <TableCell>{inv.linkOpenCount}</TableCell>
                <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {inv.status !== 'converted' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loadingId === inv.id}
                          onClick={() => handleRegenerate(inv.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          <span className="ml-1 hidden sm:inline">{labels.regenerate}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={loadingId === inv.id}
                          onClick={() => handleRevoke(inv.id)}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden />
                          <span className="ml-1 hidden sm:inline">{labels.revoke}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&invPage=${page - 1}`}>Prev</a>
            </Button>
          )}
          {page < pageCount && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&invPage=${page + 1}`}>Next</a>
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
