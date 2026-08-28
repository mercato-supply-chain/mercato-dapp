import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ReferredPymeStatus } from '@/lib/referrals/referred-pyme-status'

type Company = { id: string; company_name: string | null }

type Labels = {
  company: string
  allCompanies: string
  status: string
  allStatuses: string
  from: string
  to: string
  apply: string
  clear: string
}

const STATUS_OPTIONS: ReferredPymeStatus[] = [
  'invited',
  'account_created',
  'onboarding_incomplete',
  'inactive',
  'active',
]

type Props = {
  companies: Company[]
  labels: Labels
  statusLabels: Record<ReferredPymeStatus, string>
  values: {
    company?: string
    status?: string
    from?: string
    to?: string
  }
}

export function ReferralFiltersForm({ companies, labels, statusLabels, values }: Props) {
  return (
    <form
      method="get"
      className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-2 lg:grid-cols-5"
    >
      <div className="space-y-2">
        <Label htmlFor="referral-company">{labels.company}</Label>
        <select
          id="referral-company"
          name="company"
          defaultValue={values.company ?? 'all'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">{labels.allCompanies}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name ?? c.id}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="referral-status">{labels.status}</Label>
        <select
          id="referral-status"
          name="status"
          defaultValue={values.status ?? 'all'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">{labels.allStatuses}</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="referral-from">{labels.from}</Label>
        <Input id="referral-from" name="from" type="date" defaultValue={values.from ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="referral-to">{labels.to}</Label>
        <Input id="referral-to" name="to" type="date" defaultValue={values.to ?? ''} />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" className="w-full">{labels.apply}</Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/referrals">{labels.clear}</Link>
        </Button>
      </div>
    </form>
  )
}
