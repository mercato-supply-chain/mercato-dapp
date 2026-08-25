'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { AUDIT_ACTIONS } from '@/lib/admin/admin-audit'
import type { AdminAuditEvent } from '@/lib/admin/types'
import { useI18n } from '@/lib/i18n/provider'

const ALL = 'all'
const ENTITY_TYPES = ['profile', 'supplier_company'] as const

type AdminActivityTableProps = {
  rows: AdminAuditEvent[]
  total: number
  page: number
  pageSize: number
  admins: { id: string; name: string }[]
}

function formatJson(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value, null, 2) : '—'
}

export function AdminActivityTable({
  rows,
  total,
  page,
  pageSize,
  admins,
}: AdminActivityTableProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  function replaceParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    update(params)
    params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function pageHref(target: number): string {
    const params = new URLSearchParams(searchParams.toString())
    if (target > 1) params.set('page', String(target))
    else params.delete('page')
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const selects = [
    {
      param: 'admin',
      labelKey: 'adminActivity.filters.admin',
      options: admins.map((admin) => ({ value: admin.id, label: admin.name })),
    },
    {
      param: 'action',
      labelKey: 'adminActivity.filters.action',
      options: AUDIT_ACTIONS.map((action) => ({
        value: action,
        label: t(`adminActivity.actionLabels.${action}`),
      })),
    },
    {
      param: 'entity',
      labelKey: 'adminActivity.filters.entity',
      options: ENTITY_TYPES.map((entity) => ({
        value: entity,
        label: t(`adminActivity.entityLabels.${entity}`),
      })),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {selects.map((filter) => (
          <div key={filter.param} className="w-44">
            <Label
              className="mb-1.5 block text-xs"
              htmlFor={`activity-${filter.param}`}
            >
              {t(filter.labelKey)}
            </Label>
            <Select
              value={searchParams.get(filter.param) ?? ALL}
              onValueChange={(value) =>
                replaceParams((params) => {
                  if (value === ALL) params.delete(filter.param)
                  else params.set(filter.param, value)
                })
              }
            >
              <SelectTrigger id={`activity-${filter.param}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('adminActivity.filters.all')}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="w-40">
          <Label htmlFor="activity-from" className="mb-1.5 block text-xs">
            {t('adminActivity.filters.from')}
          </Label>
          <Input
            id="activity-from"
            type="date"
            defaultValue={searchParams.get('from') ?? ''}
            onChange={(event) =>
              replaceParams((params) => {
                if (event.target.value) params.set('from', event.target.value)
                else params.delete('from')
              })
            }
          />
        </div>
        <div className="w-40">
          <Label htmlFor="activity-to" className="mb-1.5 block text-xs">
            {t('adminActivity.filters.to')}
          </Label>
          <Input
            id="activity-to"
            type="date"
            defaultValue={searchParams.get('to') ?? ''}
            onChange={(event) =>
              replaceParams((params) => {
                if (event.target.value) params.set('to', event.target.value)
                else params.delete('to')
              })
            }
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-medium">{t('adminActivity.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('adminActivity.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminActivity.columns.when')}</TableHead>
                <TableHead>{t('adminActivity.columns.admin')}</TableHead>
                <TableHead>{t('adminActivity.columns.action')}</TableHead>
                <TableHead>{t('adminActivity.columns.entity')}</TableHead>
                <TableHead>{t('adminActivity.columns.change')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {dateFormat.format(new Date(event.createdAt))}
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <span className="block truncate text-sm">
                      {event.adminName || event.adminUserId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {t(`adminActivity.actionLabels.${event.action}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="block truncate text-sm">
                      {t(`adminActivity.entityLabels.${event.entityType}`)}
                    </span>
                    {event.entityType === 'profile' ? (
                      <Link
                        href={`/dashboard/admin/users/${event.entityId}`}
                        className="block truncate font-mono text-xs text-primary hover:underline"
                      >
                        {event.entityId}
                      </Link>
                    ) : (
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {event.entityId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-primary">
                        {t('adminActivity.viewChange')}
                        {event.reason ? ` · ${event.reason}` : ''}
                      </summary>
                      <div className="mt-1.5 space-y-1.5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {t('adminActivity.before')}
                          </p>
                          <pre className="overflow-x-auto rounded bg-muted/60 p-1.5 text-xs">
                            {formatJson(event.before)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {t('adminActivity.after')}
                          </p>
                          <pre className="overflow-x-auto rounded bg-muted/60 p-1.5 text-xs">
                            {formatJson(event.after)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <nav
        className="flex items-center justify-between gap-3"
        aria-label={t('adminActivity.paginationLabel')}
      >
        <p className="text-xs text-muted-foreground">
          {t('adminActivity.paginationSummary', { total })}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {t('adminUsers.previous')}
            </Link>
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
            >
              {t('adminUsers.next')}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </nav>
    </div>
  )
}
