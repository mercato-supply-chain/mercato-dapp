import { createServiceClient } from '@/lib/supabase/service'

export type PublicPymeProfile = {
  id: string
  company_name: string | null
  full_name: string | null
  contact_name: string | null
  bio: string | null
  country: string | null
  sector: string | null
  user_type: string | null
  verified?: boolean | null
  stake_amount?: number | null
  referred_by_supplier_id?: string | null
}

const LIST_COLUMNS =
  'id, company_name, full_name, contact_name, bio, country, sector, user_type, verified'

const DETAIL_COLUMNS =
  'id, company_name, full_name, contact_name, bio, country, sector, user_type, verified, stake_amount'

export type PymeDealRow = {
  pyme_id: string
  status: string
  amount: number
}

async function collectPublicPymeIds(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<string[]> {
  const [typedRes, dealsRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('user_type', 'pyme'),
    supabase.from('deals').select('pyme_id'),
  ])

  if (typedRes.error) throw typedRes.error
  if (dealsRes.error) throw dealsRes.error

  const ids = new Set<string>()
  for (const row of typedRes.data ?? []) ids.add(row.id)
  for (const row of dealsRes.data ?? []) {
    if (row.pyme_id) ids.add(row.pyme_id)
  }
  return [...ids]
}

/** Profiles listed in the public PyME directory (typed PyMEs + deal creators). */
export async function fetchPublicPymeProfiles(): Promise<PublicPymeProfile[]> {
  const supabase = createServiceClient()
  const ids = await collectPublicPymeIds(supabase)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select(LIST_COLUMNS)
    .in('id', ids)
    .order('company_name')

  if (error) throw error
  return (data ?? []) as PublicPymeProfile[]
}

/** Deal rows for directory reputation stats. */
export async function fetchPymeDealRows(pymeIds: string[]): Promise<PymeDealRow[]> {
  if (pymeIds.length === 0) return []

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('deals')
    .select('pyme_id, status, amount')
    .in('pyme_id', pymeIds)

  if (error) throw error
  return (data ?? []) as PymeDealRow[]
}

/** Single public PyME profile, or null when the id is not in the directory. */
export async function fetchPublicPymeProfile(id: string): Promise<PublicPymeProfile | null> {
  const supabase = createServiceClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error || !profile) return null

  if (profile.user_type === 'pyme') return profile as PublicPymeProfile

  const { count, error: dealsError } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('pyme_id', id)

  if (dealsError) throw dealsError
  if ((count ?? 0) > 0) return profile as PublicPymeProfile

  return null
}
