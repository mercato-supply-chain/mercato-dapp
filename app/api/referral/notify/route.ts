import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Reads referred_by_supplier_id from the authenticated user's profile server-side —
// the client passes no IDs, preventing spoofed notifications.
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('referred_by_supplier_id')
    .eq('id', user.id)
    .single()

  if (!profile?.referred_by_supplier_id) {
    return NextResponse.json({ ok: true })
  }

  const { data: company } = await service
    .from('supplier_companies')
    .select('owner_id, company_name')
    .eq('id', profile.referred_by_supplier_id)
    .single()

  if (!company?.owner_id) {
    return NextResponse.json({ ok: true })
  }

  await service.from('notifications').insert({
    user_id: company.owner_id,
    type: 'pyme_referred',
    title: 'A new PyME signed up using your referral link',
    body: null,
    link_url: '/dashboard',
    link_label: 'Go to dashboard',
    metadata: { pyme_id: user.id },
  })

  return NextResponse.json({ ok: true })
}
