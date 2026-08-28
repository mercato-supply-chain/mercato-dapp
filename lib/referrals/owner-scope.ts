import type { SupabaseClient } from '@supabase/supabase-js'

export async function assertSupplierOwnsCompany(
  supabase: SupabaseClient,
  ownerId: string,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('id', companyId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return Boolean(data?.id)
}
