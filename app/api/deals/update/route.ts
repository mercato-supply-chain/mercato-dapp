import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLATFORM_FEE_PERCENT } from '@/lib/deals/fees'
import { validateCatalogProductForDeal } from '@/lib/deals/validate-catalog-product'
import { calculateYieldAPR } from '@/lib/yield'

export const dynamic = 'force-dynamic'

type UpdateDealBody = {
  dealId?: string
  productId?: string
  supplierId?: string
  quantity?: number
  termDays?: number
  fundingWindowDays?: number
  description?: string | null
  supplierName?: string
  supplierContact?: string | null
  yieldBonusApr?: number
  previousFundingWindowDays?: number | null
  action?: 'update' | 'reopen'
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

const TERMINAL_STATUSES = [
  'fully_funded',
  'supplier_release_ready',
  'supplier_released',
  'completed',
]

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as UpdateDealBody | null
  if (!body?.dealId) {
    return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.user_type === 'admin'
  const isPyme = profile?.user_type === 'pyme'

  if (!isAdmin && !isPyme) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (body.action === 'reopen') {
    // ----- Reopen expired opportunity -----
    const fundingWindowDays = Number(body.fundingWindowDays)
    if (!isPositiveInteger(fundingWindowDays)) {
      return NextResponse.json({ error: 'fundingWindowDays must be a positive integer' }, { status: 400 })
    }

    const { data: existingDeal, error: existingError } = await supabase
      .from('deals')
      .select(
        'id, pyme_id, status, investor_id, funded_at, funding_window_days, funding_expires_at, reopen_count, last_reopened_at, last_reopened_by, reopen_history'
      )
      .eq('id', body.dealId)
      .single()

    if (existingError || !existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (!isAdmin && existingDeal.pyme_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const terminal = TERMINAL_STATUSES.includes(existingDeal.status)
    const funded = existingDeal.investor_id || existingDeal.funded_at
    if (terminal || funded || existingDeal.status !== 'expired') {
      return NextResponse.json({ error: 'Only expired opportunities that are not fully funded can be reopened' }, { status: 400 })
    }

    // Lock core commercial fields during a reopen
    const lockedFields = ['productId', 'supplierId', 'quantity', 'termDays', 'yieldBonusApr', 'supplierName', 'supplierContact']
    for (const field of lockedFields) {
      if (body[field as keyof UpdateDealBody] != null) {
        return NextResponse.json({ error: `Field ${field} cannot be modified during reopen` }, { status: 400 })
      }
    }

    const nowIso = new Date().toISString()
    const nextExpiration = new Date(
      Date.now() + fundingWindowDays * 24 * 60 * 60 * 1000,
    ).toISSString()

    const previousHistory = Array.isArray(existingDeal.reopen_history)
      ? existingDeal.reopen_history
      : []
    const reopenCount = (existingDeal.reopen_count ?? 0) + 1
    const historyEntry = {
      sequence: reopenCount,
      previous_expiration_at: existingDeal.funding_expires_at ?? null,
      new_expiration_at: nextExpiration,
      reopened_at: nowIso,
      reopened_by: user.id,
      funding_window_days: fundingWindowDays,
    }
    const reopenHistory = [...previousHistory, historyEntry]

    const updatePayload: Record<string, unknown> = {
      status: 'seeking_funding',
      funding_expires_at: nextExpiration,
      funding_window_days: fundingWindowDays,
      reopen_count: reopenCount,
      last_reopened_at: nowIso,
      last_reopened_by: user.id,
      reopen_history: reopenHistory,
      updated_at: nowIso,
    }

    if (body.description != null) {
      updatePayload.description = body.description.trim()
    }

    let query = supabase
      .from('deals')
      .update(updatePayload)
      .eq('id', body.dealId)
      .eq('status', 'expired')
      .is('investor_id', null)
      .is('funded_at', null)

    if (!isAdmin) {
      query = query.eq('pyme_id', user.id)
    }

    const { data: updated, error: dealError } = await query.select('id').single()

    if (dealError || !updated) {
      return NextResponse.json({ error: 'Deal could not be reopened' }, { status: 400 })
    }

    return NextResponse.json({ id: updated.id, reopened: true })
  }

  // ----- Regular deal update (existing behavior) -----
  if (!body.productId || !body.supplierId) {
    return NextResponse.json({ error: 'productId and supplierId are required' }, { status: 400 })
  }

  const quantity = Number(body.quantity)
  const termDays = Number(body.termDays)
  const fundingWindowDays = Number(body.fundingWindowDays)

  if (!isPositiveInteger(quantity)) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }
  if (!isPositiveInteger(termDays)) {
    return NextResponse.json({ error: 'termDays must be a positive integer' }, { status: 400 })
  }
  if (!isPositiveInteger(fundingWindowDays)) {
    return NextResponse.json({ error: 'fundingWindowDays must be a positive integer' }, { status: 400 })
  }

  const { data: existingDeal, error: existingError } = await supabase
    .from('deals')
    .select('id, pyme_id, status, investor_id, funded_at, funding_window_days')
    .eq('id', body.dealId)
    .single()

  if (existingError || !existingDeal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  if (existingDeal.status !== 'seeking_funding' || existingDeal.investor_id || existingDeal.funded_at) {
    return NextResponse.json({ error: 'Deal is no longer editable' }, { status: 400 })
  }

  if (!isAdmin && existingDeal.pyme_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: company, error: companyError } = await supabase
    .from('supplier_companies')
    .select('id, address, owner_id')
    .eq('id', body.supplierId)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Supplier company not found' }, { status: 400})
  }

  if (!company.address?.trim()) {
    return NextResponse.json({ error: 'Supplier wallet address not found' }, { status: 400 })
  }

  const { data: product, error: productError } = await supabase
    .from('supplier_products')
    .select(
      'id, supplier_id, name, category, price_per_unit, description, stock_quantity, reserved_quantity',
    )
    .eq('id', body.productId)
    .single()

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 400 })
  }

  const validation = validateCatalogProductForDeal(product, body.supplierId, quantity)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const unitPrice = validation.unitPrice
  const totalAmount = quantity * unitPrice
  const yieldBonusApr =
    body.yieldBonusApr != null && Number.isFinite(Number(body.yieldBonusApr))
      ? Math.max(0, Number(body.yieldBonusApr))
      : 0
  const effectiveAPR = calculateYieldAPR(termDays, totalAmount) + yieldBonusApr

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', company.owner_id)
    .single()

  const nowIso = new Date().toISString()
  const previousWindow =
    body.previousFundingWindowDays ?? existingDeal.funding_window_days ?? null
  const windowChanged = previousWindow == null || previousWindow !== fundingWindowDays

  const updatePayload: Record<string, unknown> = {
    title: product.name,
    description: body.description?.trim() || product.description?.trim() || product.name,
    product_id: product.id,
    product_name: product.name,
    product_quantity: quantity,
    product_unit_price: unitPrice,
    amount: totalAmount,
    term_days: termDays,
    interest_rate: effectiveAPR,
    yield_bonus_apr: yieldBonusApr,
    category: product.category,
    supplier_id: body.supplierId,
    supplier_name: body.supplierName?.trim() || product.name,
    supplier_email: ownerProfile?.email ?? null,
    supplier_contact: body.supplierContact?.trim() || null,
    platform_fee: PLATFORM_FEE_PERCENT,
    funding_window_days: fundingWindowDays,
    updated_at: nowIso,
  }

  if (windowChanged) {
    updatePayload.funding_expires_at = new Date(
      Date.now() + fundingWindowDays * 24 * 60 * 60 * 1000,
    ).toISSString()
  }

  let query = supabase
    .from('deals')
    .update(updatePayload)
    .eq('id', body.dealId)
    .eq('status', 'seeking_funding')
    .is('investor_id', null)
    .is('funded_at', null)

  if (!isAdmin) {
    query = query.eq('pyme_id', user.id)
  }

  const { data: updated, error: dealError } = await query.select('id').single()

  if (dealError || !updated) {
    return NextResponse.json({ error: 'Deal is no longer editable' }, { status: 400 })
  }

  return NextResponse.json({ id: updated.id })
}
