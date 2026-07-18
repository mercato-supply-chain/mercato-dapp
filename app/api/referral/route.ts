import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export type ReferralSupplier = {
  id: string
  company_name: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('supplier_companies')
    .select('id, company_name')
    .eq('id', code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, company_name: data.company_name } satisfies ReferralSupplier)
}
