/**
 * Shared plumbing for the RWA API routes.
 *
 * Every route follows the same shape: authenticate the session, build the
 * server-side dependencies, validate the body, run the domain service and
 * translate a stable error code into a response.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, requireAdmin, type AuthResult } from '@/lib/api/route-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { getRwaConfig } from '@/lib/rwa/config'
import { createChainReader } from '@/lib/rwa/chain'
import { RwaError, RWA_ERROR_CODES } from '@/lib/rwa/errors'
import { formatZodError } from '@/lib/rwa/schemas'
import type { RwaActor, RwaDependencies } from '@/lib/rwa/contribution-intent'

export const dynamic = 'force-dynamic'

/** Authenticate the caller. */
export async function requireRwaActor(): Promise<AuthResult> {
  return requireAuth()
}

/** Authenticate the caller and require the admin role. */
export async function requireRwaAdmin(): Promise<AuthResult> {
  return requireAdmin()
}

/**
 * Build the server-side dependencies.
 *
 * The service client is used for the financial writes: the protected RWA
 * operations are not callable from a browser session, and the service never
 * trusts a client-supplied identity.
 */
export function createRwaDependencies(): RwaDependencies {
  const config = getRwaConfig()
  return {
    supabase: createServiceClient(),
    chain: createChainReader(config),
    config,
  }
}

export function toActor(auth: Extract<AuthResult, { ok: true }>): RwaActor {
  return { userId: auth.userId, email: auth.email }
}

/** Parse a JSON body against a zod schema. */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Invalid JSON body')
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_REQUEST,
      'Invalid request body',
      { fields: formatZodError(parsed.error) },
    )
  }
  return parsed.data
}

/** Parse query parameters against a zod schema. */
export function parseQuery<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): z.infer<T> {
  const url = new URL(request.url)
  const raw: Record<string, string> = {}
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_REQUEST,
      'Invalid query parameters',
      { fields: formatZodError(parsed.error) },
    )
  }
  return parsed.data
}

/** Run a route handler and translate domain errors into responses. */
export async function handleRwaRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof RwaError) {
      return NextResponse.json(error.toJSON(), { status: error.status })
    }
    console.error('[rwa] unhandled route failure', error)
    return NextResponse.json(
      { error: RWA_ERROR_CODES.INTERNAL, message: 'Unexpected server error' },
      { status: 500 },
    )
  }
}
