import { redirect } from 'next/navigation'
import { DashboardHome } from '@/components/dashboard/dashboard-home'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getServerDictionary } from '@/lib/i18n/server'
import { getServerAuth } from '@/lib/auth/server-auth-helper'

type DashboardSearchParams = Promise<{ company?: string }> | { company?: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams
}) {
  // Run independent operations in parallel: dictionary, params, and auth
  const [t, authResult, params] = await Promise.all([
    getServerDictionary(),
    getServerAuth(),
    searchParams
      ? getSearchParamsPromise(searchParams)
      : Promise.resolve({} as { company?: string }),
  ])

  const { user, profile, supabase } = authResult
  const companyFilterId = params.company ?? null

  if (!user) {
    redirect('/auth/login')
  }

  // Required query failures surface to the route error boundary instead of
  // being silently coerced into zero/empty data. Optional section failures are
  // represented in the payload and rendered explicitly by the dashboard.
  const data = await getDashboardData(supabase, user.id, profile, user.email, companyFilterId)

  return <DashboardHome data={data} t={t} />
}

async function getSearchParamsPromise(
  searchParams: DashboardSearchParams,
): Promise<{ company?: string }> {
  if (typeof (searchParams as Promise<{ company?: string }>).then === 'function') {
    return searchParams as Promise<{ company?: string }>
  }

  return Promise.resolve(searchParams as { company?: string })
}
