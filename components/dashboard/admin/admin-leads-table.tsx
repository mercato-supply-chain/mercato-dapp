'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useI18n } from '@/lib/i18n/provider'
import type { LeadRow } from '@/lib/admin/get-leads'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

type AdminLeadsTableProps = {
  leads: LeadRow[]
  eventSlugs: string[]
  selectedEvent: string | null
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function truncate(value: string | null, max = 80) {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function leadsToCsv(leads: LeadRow[]) {
  const headers = [
    'created_at',
    'event_slug',
    'name',
    'email',
    'company',
    'role',
    'country',
    'phone',
    'current_financing',
    'funding_timeline',
    'supplier_payment_process',
    'biggest_challenge',
    'last_financing_experience',
    'locale',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'referrer',
  ]

  const escape = (value: string | null | undefined) => {
    const text = value ?? ''
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const rows = leads.map((lead) =>
    headers.map((header) => escape(lead[header as keyof LeadRow] as string | null)).join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}

export function AdminLeadsTable({ leads, eventSlugs, selectedEvent }: AdminLeadsTableProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filterValue = selectedEvent ?? 'all'

  const onFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('event')
    } else {
      params.set('event', value)
    }
    router.push(`/dashboard/admin/leads?${params.toString()}`)
  }

  const exportCsv = () => {
    const csv = leadsToCsv(leads)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mercato-leads-${selectedEvent ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const expandedLead = useMemo(
    () => leads.find((lead) => lead.id === expandedId) ?? null,
    [expandedId, leads],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('adminLeads.filterEvent')}</span>
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminLeads.filterAll')}</SelectItem>
              {eventSlugs.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={leads.length === 0}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t('adminLeads.exportCsv')}
        </Button>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          {t('adminLeads.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminLeads.columns.date')}</TableHead>
                <TableHead>{t('adminLeads.columns.name')}</TableHead>
                <TableHead>{t('adminLeads.columns.company')}</TableHead>
                <TableHead>{t('adminLeads.columns.role')}</TableHead>
                <TableHead>{t('adminLeads.columns.email')}</TableHead>
                <TableHead>{t('adminLeads.columns.event')}</TableHead>
                <TableHead>{t('adminLeads.columns.challenge')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={cn('cursor-pointer', expandedId === lead.id && 'bg-muted/40')}
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(lead.created_at, locale)}
                  </TableCell>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.company ?? '—'}</TableCell>
                  <TableCell className="capitalize">{lead.role ?? '—'}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell className="text-xs">{lead.event_slug}</TableCell>
                  <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                    {truncate(lead.biggest_challenge)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {expandedLead ? (
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <h3 className="mb-4 font-semibold">{t('adminLeads.detailTitle')}</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ['adminLeads.fields.currentFinancing', expandedLead.current_financing],
              ['adminLeads.fields.fundingTimeline', expandedLead.funding_timeline],
              ['adminLeads.fields.supplierPaymentProcess', expandedLead.supplier_payment_process],
              ['adminLeads.fields.biggestChallenge', expandedLead.biggest_challenge],
              ['adminLeads.fields.lastFinancingExperience', expandedLead.last_financing_experience],
              ['adminLeads.fields.phone', expandedLead.phone],
              ['adminLeads.fields.country', expandedLead.country],
            ].map(([labelKey, value]) => (
              <div key={labelKey}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(labelKey)}
                </dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">{value || '—'}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('adminLeads.fields.attribution')}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {[expandedLead.utm_source, expandedLead.utm_medium, expandedLead.utm_campaign]
                  .filter(Boolean)
                  .join(' · ') || '—'}
                {expandedLead.referrer ? (
                  <span className="mt-1 block text-xs">Referrer: {expandedLead.referrer}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
