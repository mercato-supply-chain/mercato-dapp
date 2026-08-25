import { test, expect, mock, afterEach, beforeEach } from 'bun:test'

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as nextNavigation from 'next/navigation'

const toasts: { success: string[]; error: string[] } = { success: [], error: [] }
const refreshes: number[] = []

mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

// Keep every real export so later test files still find usePathname etc.
mock.module('next/navigation', () => ({
  ...nextNavigation,
  useRouter: () => ({ refresh: () => refreshes.push(1) }),
}))

mock.module('sonner', () => ({
  toast: {
    success: (message: string) => toasts.success.push(message),
    error: (message: string) => toasts.error.push(message),
  },
}))

const { AdminVerifyDialog } = await import(
  '@/components/dashboard/admin/admin-verify-dialog'
)

const fetchCalls: { url: string; body: Record<string, unknown> }[] = []

beforeEach(() => {
  toasts.success = []
  toasts.error = []
  refreshes.length = 0
  fetchCalls.length = 0
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    })
    return Response.json({ ok: true, auditEventId: 'audit-1' })
  }) as typeof fetch
})

afterEach(() => {
  mock.restore()
  cleanup()
})

test('opens a confirmation dialog before verifying', async () => {
  const user = userEvent.setup()
  render(
    <AdminVerifyDialog
      entityType="profile"
      entityId="user-1"
      entityName="Cafetal SA"
      verified={false}
    />,
  )

  expect(screen.queryByText(/verifyConfirmTitle/)).toBeNull()
  await user.click(screen.getByRole('button', { name: /verifyAction/ }))
  expect(screen.getByText(/adminUsers.verifyConfirmTitle/)).toBeTruthy()
  expect(fetchCalls).toHaveLength(0)
})

test('posts the verification with reason and refreshes on confirm', async () => {
  const user = userEvent.setup()
  render(
    <AdminVerifyDialog
      entityType="supplier_company"
      entityId="company-1"
      entityName="Granos MX"
      verified={false}
    />,
  )

  await user.click(screen.getByRole('button', { name: /verifyAction/ }))
  await user.type(
    screen.getByLabelText(/verifyReasonLabel/),
    'Docs reviewed',
  )
  await user.click(screen.getAllByRole('button', { name: /verifyAction/ }).at(-1)!)

  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].url).toBe('/api/admin/verification')
  expect(fetchCalls[0].body).toEqual({
    entityType: 'supplier_company',
    entityId: 'company-1',
    verified: true,
    reason: 'Docs reviewed',
  })
  expect(toasts.success).toHaveLength(1)
  expect(refreshes).toHaveLength(1)
})

test('unverify flow sends verified=false and shows an error toast on failure', async () => {
  globalThis.fetch = (async () =>
    Response.json({ error: 'Forbidden' }, { status: 403 })) as typeof fetch

  const user = userEvent.setup()
  render(
    <AdminVerifyDialog
      entityType="profile"
      entityId="user-2"
      entityName="Someone"
      verified={true}
    />,
  )

  await user.click(screen.getByRole('button', { name: /unverifyAction/ }))
  await user.click(screen.getAllByRole('button', { name: /unverifyAction/ }).at(-1)!)

  expect(toasts.error).toHaveLength(1)
  expect(refreshes).toHaveLength(0)
})
