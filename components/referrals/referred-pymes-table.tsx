import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReferredPymeView } from '@/lib/referrals/get-supplier-referral-dashboard'
import type { ReferredPymeStatus } from '@/lib/referrals/referred-pyme-status'
import { ReferralStatusBadge } from './referral-status-badge'

type Labels = {
  title: string
  empty: string
  company: string
  status: string
  deals: string
  requested: string
  funded: string
  source: string
  directReferral: string
  viewProfile: string
  statusLabels: Record<ReferredPymeStatus, string>
}

type Props = {
  rows: ReferredPymeView[]
  labels: Labels
  page: number
  total: number
  pageSize: number
  baseQuery: string
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function ReferredPymesTable({ rows, labels, page, total, pageSize, baseQuery }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.company}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.deals}</TableHead>
              <TableHead>{labels.requested}</TableHead>
              <TableHead>{labels.funded}</TableHead>
              <TableHead>{labels.source}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const name =
                row.profile.company_name ??
                row.profile.full_name ??
                row.profile.contact_name ??
                labels.directReferral
              return (
                <TableRow key={`${row.profileId ?? row.referralInvitationId}`}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>
                    <ReferralStatusBadge status={row.status} label={labels.statusLabels[row.status]} />
                  </TableCell>
                  <TableCell>{row.dealCount}</TableCell>
                  <TableCell>{formatUsd(row.requestedVolume)}</TableCell>
                  <TableCell>{formatUsd(row.fundedVolume)}</TableCell>
                  <TableCell>
                    {row.attributionSource === 'legacy' ? labels.directReferral : 'Invitation'}
                  </TableCell>
                  <TableCell>
                    {row.profileId ? (
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link href={`/pymes/${row.profileId}`}>{labels.viewProfile}</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&pymePage=${page - 1}`}>Prev</a>
            </Button>
          )}
          {page < pageCount && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&pymePage=${page + 1}`}>Next</a>
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
