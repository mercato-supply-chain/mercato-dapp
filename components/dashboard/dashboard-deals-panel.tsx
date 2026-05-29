'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Building2, Clock, ExternalLink, Plus, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/date-utils'
import type { DashboardDealRow } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'funded' || status === 'in_progress') return 'secondary'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

type DealStatusLabels = Record<string, string>

type DashboardDealsPanelProps = {
  userType: string
  deals: DashboardDealRow[]
  totalCount: number
  viewAllHref: string
  statusLabels: DealStatusLabels
  labels: {
    title: string
    viewAll: string
    emptyTitle: string
    emptyBody: string
    emptyCta?: string
    emptyCtaHref?: string
    showing: string
    viewAllFooter: string
    dealUntitled: string
    tableView: string
    tableAct: string
    tableApprove: string
    openLabel: string
    milestoneActionNeeded: string
    aprSummary: string
    tableFunded?: string
    tableDeal?: string
    tableStatus?: string
    tableAmount?: string
    tableCompany?: string
    tableSmb?: string
    tableSupplier?: string
    tableInvestor?: string
    tableCreated?: string
    tableMilestones?: string
  }
  columns: {
    showSmb?: boolean
    showSupplier?: boolean
    showInvestor?: boolean
    showCompany?: boolean
    showCreated?: boolean
    showFunded?: boolean
  }
}

export function DashboardDealsPanel({
  userType,
  deals,
  totalCount,
  viewAllHref,
  statusLabels,
  labels,
  columns,
}: DashboardDealsPanelProps) {
  if (deals.length === 0) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Clock className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{labels.emptyTitle}</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">{labels.emptyBody}</p>
          {labels.emptyCta && labels.emptyCtaHref && (
            <Button asChild>
              <Link href={labels.emptyCtaHref}>
                <Plus className="mr-2 h-4 w-4" />
                {labels.emptyCta}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{labels.title}</h2>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link href={viewAllHref}>
            {labels.viewAll}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3 lg:hidden">
        {deals.map((deal) => (
          <DealCardMobile
            key={deal.id}
            deal={deal}
            userType={userType}
            statusLabels={statusLabels}
            labels={labels}
            columns={columns}
          />
        ))}
      </div>

      <Card className="hidden overflow-hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-4 text-left font-medium">{labels.tableDeal}</th>
                  <th className="p-4 text-left font-medium">{labels.tableStatus}</th>
                  <th className="p-4 text-right font-medium">{labels.tableAmount}</th>
                  {columns.showCompany && (
                    <th className="hidden p-4 text-left font-medium lg:table-cell">{labels.tableCompany}</th>
                  )}
                  {columns.showSmb && (
                    <th className="hidden p-4 text-left font-medium lg:table-cell">{labels.tableSmb}</th>
                  )}
                  {columns.showSupplier && (
                    <th className="hidden p-4 text-left font-medium lg:table-cell">{labels.tableSupplier}</th>
                  )}
                  {columns.showInvestor && (
                    <th className="hidden p-4 text-left font-medium xl:table-cell">{labels.tableInvestor}</th>
                  )}
                  {columns.showFunded && labels.tableFunded && (
                    <th className="hidden p-4 text-left font-medium xl:table-cell">{labels.tableFunded}</th>
                  )}
                  {columns.showCreated && (
                    <th className="hidden p-4 text-left font-medium lg:table-cell">{labels.tableCreated}</th>
                  )}
                  <th className="hidden p-4 text-center font-medium sm:table-cell">{labels.tableMilestones}</th>
                  <th className="w-24 p-4 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <DealTableRow
                    key={deal.id}
                    deal={deal}
                    userType={userType}
                    statusLabels={statusLabels}
                    labels={labels}
                    columns={columns}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">{labels.showing}</p>
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href={viewAllHref}>
                {labels.viewAllFooter}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function partyName(p?: { company_name?: string; full_name?: string; contact_name?: string } | null) {
  return p?.company_name || p?.full_name || p?.contact_name || '—'
}

function PartyWithLogo({ 
  p, 
  fallbackIcon: Icon = Building2 
}: { 
  p?: { company_name?: string; full_name?: string; contact_name?: string; logo_url?: string | null } | null
  fallbackIcon?: any
}) {
  const name = partyName(p)
  const [imageError, setImageError] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/30">
        {p?.logo_url && !imageError ? (
          <img
            src={p.logo_url}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
      </div>
      <span className="truncate">{name}</span>
    </div>
  )
}

function DealCardMobile({
  deal,
  userType,
  statusLabels,
  labels,
  columns,
}: {
  deal: DashboardDealRow
  userType: string
  statusLabels: DealStatusLabels
  labels: DashboardDealsPanelProps['labels']
  columns: DashboardDealsPanelProps['columns']
}) {
  const milestones = deal.milestones ?? []
  const completed = milestones.filter((m) => m.status === 'completed').length
  const pending = milestones.filter((m) => m.status === 'in_progress').length
  const hasPending = pending > 0
  const statusLabel = statusLabels[deal.status] ?? deal.status

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-brand-light/40 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug">{deal.product_name || deal.title || labels.dealUntitled}</p>
        <Badge variant={statusBadgeVariant(deal.status)} className="shrink-0">
          {statusLabel}
        </Badge>
      </div>
      <p className="text-lg font-bold tabular-nums">${Number(deal.amount).toLocaleString()}</p>
      {columns.showSmb && (
        <div className="mt-1 text-xs text-muted-foreground">
          <PartyWithLogo p={deal.pyme} fallbackIcon={User} />
        </div>
      )}
      {hasPending && userType === 'supplier' && (
        <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          {labels.milestoneActionNeeded}
        </p>
      )}
    </Link>
  )
}

function DealTableRow({
  deal,
  userType,
  statusLabels,
  labels,
  columns,
}: {
  deal: DashboardDealRow
  userType: string
  statusLabels: DealStatusLabels
  labels: DashboardDealsPanelProps['labels']
  columns: DashboardDealsPanelProps['columns']
}) {
  const milestones = deal.milestones ?? []
  const completed = milestones.filter((m) => m.status === 'completed').length
  const pending = milestones.filter((m) => m.status === 'in_progress').length
  const total = milestones.length
  const hasPending = pending > 0
  const statusLabel = statusLabels[deal.status] ?? deal.status

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20">
      <td className="p-4">
        <Link href={`/deals/${deal.id}`} className="font-medium hover:underline">
          {deal.product_name || deal.title || labels.dealUntitled}
        </Link>
        {deal.term_days != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {labels.aprSummary
              .replace('{days}', String(deal.term_days))
              .replace('{rate}', String(deal.interest_rate ?? '—'))}
          </p>
        )}
      </td>
      <td className="p-4">
        <Badge variant={statusBadgeVariant(deal.status)}>{statusLabel}</Badge>
      </td>
      <td className="p-4 text-right font-medium tabular-nums">${Number(deal.amount).toLocaleString()}</td>
      {columns.showCompany && (
        <td className="hidden p-4 text-xs text-muted-foreground lg:table-cell">
          <PartyWithLogo p={deal.supplier} />
        </td>
      )}
      {columns.showSmb && (
        <td className="hidden p-4 text-xs text-muted-foreground lg:table-cell">
          <PartyWithLogo p={deal.pyme} fallbackIcon={User} />
        </td>
      )}
      {columns.showSupplier && (
        <td className="hidden p-4 text-xs text-muted-foreground xl:table-cell">
          <PartyWithLogo p={deal.supplier} />
        </td>
      )}
      {columns.showInvestor && (
        <td className="hidden p-4 text-xs text-muted-foreground xl:table-cell">
          <PartyWithLogo p={deal.investor} fallbackIcon={User} />
        </td>
      )}
      {columns.showFunded && (
        <td className="hidden p-4 text-xs text-muted-foreground xl:table-cell">
          {deal.funded_at ? formatDate(deal.funded_at) : '—'}
        </td>
      )}
      {columns.showCreated && (
        <td className="hidden p-4 text-xs text-muted-foreground lg:table-cell">
          {deal.created_at ? formatDate(deal.created_at) : '—'}
        </td>
      )}
      <td className="hidden p-4 text-center sm:table-cell">
        {total > 0 ? (
          <span className={cn('text-xs', hasPending && 'font-medium text-amber-600 dark:text-amber-400')}>
            {completed}/{total}
            {hasPending && <AlertCircle className="ml-1 inline h-3 w-3" />}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="p-4 text-right">
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href={`/deals/${deal.id}`}>
            {userType === 'supplier' && hasPending ? labels.tableAct : labels.tableView}
            <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
          </Link>
        </Button>
        {userType === 'admin' && hasPending && (
          <Button asChild size="sm" className="ml-1 h-7 px-2 text-xs">
            <Link href="/dashboard/admin/approvals">{labels.tableApprove}</Link>
          </Button>
        )}
      </td>
    </tr>
  )
}
