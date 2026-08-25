'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BadgeCheck, ChevronLeft, ChevronRight, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminUserListItem } from '@/lib/admin/types'
import { useI18n } from '@/lib/i18n/provider'

type AdminUsersTableProps = {
  rows: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
}

function displayName(row: AdminUserListItem): string {
  return row.companyName || row.fullName || row.contactName || row.email
}

function onboardingKey(row: AdminUserListItem): string {
  if (!row.userType) return 'adminUsers.onboarding.incomplete'
  if (row.onboardingCompletedAt) return 'adminUsers.onboarding.completed'
  return 'adminUsers.onboarding.legacy'
}

export function AdminUsersTable({ rows, total, page, pageSize }: AdminUsersTableProps) {
  const { t, locale } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    dateStyle: 'medium',
  })

  function pageHref(target: number): string {
    const params = new URLSearchParams(searchParams.toString())
    if (target > 1) params.set('page', String(target))
    else params.delete('page')
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
        <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
        <p className="font-medium">{t('adminUsers.emptyTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('adminUsers.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminUsers.columns.user')}</TableHead>
              <TableHead>{t('adminUsers.columns.role')}</TableHead>
              <TableHead>{t('adminUsers.columns.country')}</TableHead>
              <TableHead>{t('adminUsers.columns.onboarding')}</TableHead>
              <TableHead>{t('adminUsers.columns.verification')}</TableHead>
              <TableHead>{t('adminUsers.columns.wallet')}</TableHead>
              <TableHead>{t('adminUsers.columns.signup')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('adminUsers.columns.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[220px]">
                  <span className="block truncate font-medium">{displayName(row)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.email}
                  </span>
                </TableCell>
                <TableCell>
                  {row.userType ? (
                    <Badge variant="secondary">
                      {t(`adminUsers.roles.${row.userType}`)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{row.country ?? '—'}</TableCell>
                <TableCell className="text-sm">{t(onboardingKey(row))}</TableCell>
                <TableCell>
                  {row.verified ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800/50 dark:text-emerald-300"
                    >
                      <BadgeCheck className="h-3 w-3" aria-hidden />
                      {t('adminUsers.verification.verified')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t('adminUsers.verification.unverified')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.walletProvider ? (
                    <span>
                      {t(
                        row.walletProvider === 'pollar'
                          ? 'adminUsers.wallet.pollar'
                          : 'adminUsers.wallet.swk',
                      )}
                      {row.walletStatus ? (
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          · {row.walletStatus}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('adminUsers.wallet.none')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {dateFormat.format(new Date(row.createdAt))}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/admin/users/${row.id}`}>
                      {t('adminUsers.viewDetail')}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <nav
        className="flex items-center justify-between gap-3"
        aria-label={t('adminUsers.paginationLabel')}
      >
        <p className="text-xs text-muted-foreground">
          {t('adminUsers.paginationSummary', {
            from: (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, total),
            total,
          })}
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
