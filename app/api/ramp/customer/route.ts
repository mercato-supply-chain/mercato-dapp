import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Creates or retrieves a BlindPay customer record.
 * This endpoint is called after the config fetch to initialize the customer session.
 * 
 * Request body:
 * - email: string (required)
 * - name?: string
 * - company?: string
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { email, name, company } = body

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  
  // Normalize email
  const normalizedEmail = email.toLowerCase().trim()

  // Check if customer already exists
  const { data: existingCustomer, error: fetchError } = await supabase
    .from('blindpay_customers')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to fetch customer:', fetchError)
    return NextResponse.json({ error: 'Failed to check existing customer' }, { status: 500 })
  }

  if (existingCustomer) {
    return NextResponse.json({ 
      ok: true,
      customer: existingCustomer,
      existing: true,
    })
  }

  // Create new customer
  const { data: newCustomer, error: insertError } = await supabase
    .from('blindpay_customers')
    .insert({
      email: normalizedEmail,
      name: name?.trim() || null,
      company: company?.trim() || null,
      status: 'pending',
    })
    .select()
    .maybeSingle()

  if (insertError) {
    console.error('Failed to create customer:', insertError)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    customer: newCustomer,
    existing: false,
  })
}
