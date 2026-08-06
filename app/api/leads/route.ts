import { NextResponse } from 'next/server'
import { getEventBySlug } from '@/lib/events/config'
import { leadSubmissionSchema } from '@/lib/events/lead-schema'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const DEDUP_WINDOW_MS = 5 * 60 * 1000

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = leadSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const data = parsed.data
  const event = getEventBySlug(data.event_slug)
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const normalizedEmail = data.email.toLowerCase()

  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  const { data: recent } = await supabase
    .from('leads')
    .select('id')
    .eq('event_slug', data.event_slug)
    .eq('email', normalizedEmail)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()

  if (recent) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const { error } = await supabase.from('leads').insert({
    event_slug: data.event_slug,
    name: data.name,
    email: normalizedEmail,
    company: data.company,
    role: data.role,
    country: data.country,
    phone: data.phone || null,
    current_financing: data.current_financing,
    funding_timeline: data.funding_timeline,
    supplier_payment_process: data.supplier_payment_process,
    biggest_challenge: data.biggest_challenge,
    last_financing_experience: data.last_financing_experience || null,
    locale: data.locale ?? null,
    utm_source: data.utm_source ?? null,
    utm_medium: data.utm_medium ?? null,
    utm_campaign: data.utm_campaign ?? null,
    referrer: data.referrer ?? null,
  })

  if (error) {
    console.error('Lead insert failed:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
