import { redirect } from 'next/navigation'
import {
  InvestmentsDashboard,
  parseInvestmentsTab,
} from '@/components/investments/investments-dashboard'
import { getDashboardSession } from '@/lib/dashboard/get-dashboard-session'
import { getInvestorPortfolio } from '@/lib/investments/get-investor-portfolio'
import { getServerDictionary } from '@/lib/i18n/server'

type InvestmentsSearchParams = { tab?: string; page?: string }
type SearchParams = Promise<InvestmentsSearchParams> | InvestmentsSearchParams

async function resolveSearchParams(searchParams?: SearchParams): Promise<InvestmentsSearchParams> {
  return (await searchParams) ?? {}
}

export default async function DashboardInvestmentsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  // The dictionary and search params do not depend on the user, so start them before auth.
  const dictionaryPromise = getServerDictionary()
  const paramsPromise = resolveSearchParams(searchParams)
  // A redirect below can abandon these; observe rejections so none goes unhandled.
  // Awaiting them later still throws the original error.
  dictionaryPromise.catch(() => {})
  paramsPromise.catch(() => {})

  // Shared with the dashboard layout through cache(): one auth check and profile query per request.
  const { supabase, user, profile } = await getDashboardSession()
  if (!user) redirect('/auth/login')

  const [t, params] = await Promise.all([dictionaryPromise, paramsPromise])
  const page = Number(params.page) > 0 ? Number(params.page) : 1

  const portfolio = await getInvestorPortfolio(
    supabase,
    user.id,
    profile,
    {
      smbFallback: t.investments.smbFallbackName,
      dealFallbackTitle: t.investments.dealFallbackTitle,
    },
    { page },
  )

  if (!portfolio) redirect('/dashboard')

  const tab = parseInvestmentsTab(params.tab)

  return <InvestmentsDashboard portfolio={portfolio} tab={tab} t={t} />
}
