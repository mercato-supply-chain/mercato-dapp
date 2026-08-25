import { describe, expect, test } from 'bun:test'
import {
  buildAdminTasks,
  PRIORITY_ORDER,
  STALE_ESCROW_HOURS,
  STALE_ONBOARDING_DAYS,
  type AdminTaskInputs,
} from '@/lib/admin/admin-task-rules'
import type { CreateEscrowItem, ReleaseFallbackItem } from '@/lib/admin/types'

const NOW = new Date('2026-08-24T12:00:00.000Z')

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24)
}

function emptyInputs(): AdminTaskInputs {
  return {
    queue: { createEscrowItems: [], releaseFallbackItems: [] },
    pendingVerificationProfiles: [],
    pendingVerificationCompanies: [],
    incompleteOnboardings: [],
    awaitingFundingDeals: [],
    vaultConfigured: true,
    vaultAlerts: [],
  }
}

function createEscrowItem(overrides: Partial<CreateEscrowItem> = {}): CreateEscrowItem {
  return {
    dealId: 'deal-1',
    dealTitle: 'Coffee restock',
    dealProductName: null,
    principal: 1000,
    aprPercent: 12,
    termDays: 90,
    totalGrossed: 1043,
    defaultFirstMilestoneAmount: 521.5,
    pymeName: 'Cafetal SA',
    supplierName: 'Granos MX',
    supplierLogoUrl: null,
    createdAt: hoursAgo(2),
    ...overrides,
  }
}

function releaseItem(overrides: Partial<ReleaseFallbackItem> = {}): ReleaseFallbackItem {
  return {
    dealId: 'deal-2',
    dealTitle: 'Textile order',
    dealProductName: null,
    escrowContractAddress: 'CESCROW',
    milestoneId: 'deal-2:repayment:release:0',
    milestoneTitle: 'Repayment #1',
    milestoneIndex: 0,
    milestoneAmount: 500,
    milestonePercentage: 50,
    completedAt: hoursAgo(5),
    supplierLogoUrl: null,
    ...overrides,
  }
}

describe('buildAdminTasks', () => {
  test('returns no tasks for empty inputs', () => {
    expect(buildAdminTasks(emptyInputs(), NOW)).toEqual([])
  })

  test('missing vault configuration is a critical task', () => {
    const tasks = buildAdminTasks({ ...emptyInputs(), vaultConfigured: false }, NOW)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].type).toBe('vault_unconfigured')
    expect(tasks[0].priority).toBe('critical')
    expect(tasks[0].href).toBe('/dashboard/admin/vault')
  })

  test('only critical vault alerts become tasks', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        vaultAlerts: [
          { id: 'paused-x', severity: 'critical', title: 'Strategy paused', description: '' },
          { id: 'high-idle', severity: 'warning', title: 'High idle', description: '' },
        ],
      },
      NOW,
    )
    expect(tasks).toHaveLength(1)
    expect(tasks[0].type).toBe('vault_alert')
    expect(tasks[0].titleParams).toEqual({ alert: 'Strategy paused' })
  })

  test('escrow creation and milestone release map to high priority with queue links', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        queue: {
          createEscrowItems: [createEscrowItem()],
          releaseFallbackItems: [releaseItem()],
        },
      },
      NOW,
    )
    const create = tasks.find((t) => t.type === 'create_escrow')
    const release = tasks.find((t) => t.type === 'milestone_release')
    expect(create?.priority).toBe('high')
    expect(create?.href).toBe('/dashboard/admin/approvals')
    expect(release?.priority).toBe('high')
    expect(release?.href).toBe('/dashboard/admin/releases')
  })

  test('awaiting-funding escrows turn stale after the threshold', () => {
    const fresh = {
      id: 'deal-f',
      title: 'Fresh escrow',
      repaymentStatus: 'funding',
      updatedAt: hoursAgo(STALE_ESCROW_HOURS - 1),
    }
    const stale = {
      id: 'deal-s',
      title: 'Stuck escrow',
      repaymentStatus: 'escrow_initialized',
      updatedAt: hoursAgo(STALE_ESCROW_HOURS + 1),
    }
    const tasks = buildAdminTasks(
      { ...emptyInputs(), awaitingFundingDeals: [fresh, stale] },
      NOW,
    )
    const freshTask = tasks.find((t) => t.id === 'escrow:funding:deal-f')
    const staleTask = tasks.find((t) => t.id === 'escrow:funding:deal-s')
    expect(freshTask?.type).toBe('escrow_awaiting_funding')
    expect(freshTask?.priority).toBe('normal')
    expect(staleTask?.type).toBe('stale_escrow')
    expect(staleTask?.priority).toBe('high')
    expect(staleTask?.href).toBe('/deals/deal-s')
  })

  test('verification tasks deep-link to the user detail page', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        pendingVerificationProfiles: [
          { id: 'user-1', name: 'Cafetal SA', createdAt: daysAgo(1) },
        ],
        pendingVerificationCompanies: [
          { id: 'company-1', name: 'Granos MX', createdAt: daysAgo(2) },
        ],
      },
      NOW,
    )
    expect(tasks).toHaveLength(2)
    const profileTask = tasks.find((t) => t.id === 'verify:profile:user-1')
    expect(profileTask?.priority).toBe('normal')
    expect(profileTask?.href).toBe('/dashboard/admin/users/user-1')
  })

  test('incomplete onboarding surfaces only after the age threshold', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        incompleteOnboardings: [
          { id: 'new-user', name: 'new@x.com', createdAt: daysAgo(STALE_ONBOARDING_DAYS - 1) },
          { id: 'old-user', name: 'old@x.com', createdAt: daysAgo(STALE_ONBOARDING_DAYS + 1) },
        ],
      },
      NOW,
    )
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('onboarding:old-user')
    expect(tasks[0].priority).toBe('informational')
  })

  test('sorts by priority rank then oldest first', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        vaultConfigured: false,
        queue: {
          createEscrowItems: [
            createEscrowItem({ dealId: 'young', createdAt: hoursAgo(1) }),
            createEscrowItem({ dealId: 'old', createdAt: hoursAgo(10) }),
          ],
          releaseFallbackItems: [],
        },
        pendingVerificationProfiles: [
          { id: 'user-1', name: 'Someone', createdAt: daysAgo(3) },
        ],
      },
      NOW,
    )
    expect(tasks.map((t) => t.id)).toEqual([
      'vault:unconfigured',
      'escrow:create:old',
      'escrow:create:young',
      'verify:profile:user-1',
    ])
    const ranks = tasks.map((t) => PRIORITY_ORDER[t.priority])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  test('age is computed relative to now and never negative', () => {
    const tasks = buildAdminTasks(
      {
        ...emptyInputs(),
        queue: {
          createEscrowItems: [
            createEscrowItem({ dealId: 'future', createdAt: hoursAgo(-1) }),
          ],
          releaseFallbackItems: [],
        },
      },
      NOW,
    )
    expect(tasks[0].ageMs).toBe(0)
  })
})
