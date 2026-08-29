import type { SupabaseClient } from '@supabase/supabase-js'

export type SupplierActivityAuthorization =
  | { status: 'unauthenticated' }
  | { status: 'unauthorized' }
  | { status: 'authorized'; userId: string }

/** Resolves whether the current session belongs to an authenticated supplier user. */
export async function authorizeSupplierActivityAccess(
  supabase: SupabaseClient,
): Promise<SupplierActivityAuthorization> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: 'unauthenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'supplier') {
    return { status: 'unauthorized' }
  }

  return { status: 'authorized', userId: user.id }
}
