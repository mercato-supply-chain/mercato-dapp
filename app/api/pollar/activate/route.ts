import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_POLLAR_SERVER_API = 'https://server.api.pollar.xyz/v3'
const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/

function serverApiBase(): string {
  const raw = (process.env.POLLAR_SERVER_API_URL ?? DEFAULT_POLLAR_SERVER_API).replace(/\/$/, '')
  if (raw.endsWith('/v3') || raw.endsWith('/v1')) return raw
  return `${raw}/v3`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as
    | { publicKey?: unknown; walletId?: unknown }
    | null

  const publicKeyCandidate =
    typeof payload?.publicKey === 'string'
      ? payload.publicKey.trim()
      : typeof payload?.walletId === 'string'
        ? payload.walletId.trim()
        : ''

  if (!STELLAR_PUBLIC_KEY.test(publicKeyCandidate)) {
    return NextResponse.json(
      { error: 'A Stellar public key (G…) is required to fund the Pollar wallet' },
      { status: 400 },
    )
  }

  const secretKey = process.env.POLLAR_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Pollar secret key is not configured' }, { status: 500 })
  }

  const fundUrl = `${serverApiBase()}/wallets/fund`

  try {
    const response = await fetch(fundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pollar-api-key': secretKey,
      },
      body: JSON.stringify({ publicKey: publicKeyCandidate }),
    })

    const data = (await response.json().catch(() => null)) as
      | {
          status?: string
          error?: string
          message?: string
          code?: string
          content?: { publicKey?: string; requestId?: string }
        }
      | null

    const alreadyFunded = response.status === 409 || data?.code === 'WALLET_ALREADY_FUNDED'
    if (alreadyFunded) {
      await supabase
        .from('profiles')
        .update({
          wallet_status: 'active',
          wallet_provider: 'pollar',
          stellar_public_key: publicKeyCandidate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      return NextResponse.json({
        status: 'active',
        message: 'Wallet activation already completed',
      })
    }

    if (response.status === 202) {
      return NextResponse.json({
        status: 'pending',
        message:
          'Pollar opened the account-creation request. Approve it in the Pollar wallet to finish activation.',
        requestId: data?.content?.requestId,
      })
    }

    if (!response.ok) {
      const errorMessage =
        data?.error ||
        data?.message ||
        data?.code ||
        (response.status === 400
          ? 'Invalid Stellar public key'
          : response.status === 402
            ? 'Wallet activation requires funding'
            : response.status === 404
              ? 'Pollar does not recognize this wallet'
              : 'Failed to activate wallet')
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    await supabase
      .from('profiles')
      .update({
        wallet_status: 'active',
        wallet_provider: 'pollar',
        stellar_public_key: publicKeyCandidate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return NextResponse.json({
      status: data?.status ?? 'active',
      message: data?.message ?? 'Wallet activated',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate wallet'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
