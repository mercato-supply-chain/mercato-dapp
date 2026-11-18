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
      ? typeof (searchParams as Promise<{ company?: string }>).then === 'function'
        ? (searchParams as Promise<{ company?: string }>)
        : Promise.resolve(searchParams as { company?: string })
      : Promise.resolve({} as { company?: string }),
  ])

  const { user, profile, supabase } = authResult
  const companyFilterId = params.company ?? null

  if (!user) {
    redirect('/auth/login')
  }

  const data = await getDashboardData(supabase, user.id, profile, user.email, companyFilterId)

  return <DashboardHome data={data} t={t} />
}
