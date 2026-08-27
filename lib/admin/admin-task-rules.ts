import type {
  AdminQueueData,
  AdminTask,
  AdminTaskPriority,
} from './types'

/** Escrows stuck in escrow_initialized/funding longer than this are stale. */
export const STALE_ESCROW_HOURS = 48

/** Incomplete onboardings older than this surface as informational tasks. */
export const STALE_ONBOARDING_DAYS = 7

export const PRIORITY_ORDER: Record<AdminTaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  informational: 3,
}

export type AdminTaskEntity = {
  id: string
  name: string
  createdAt: string | null
}

export type AwaitingFundingDeal = {
  id: string
  title: string
  repaymentStatus: string
  updatedAt: string | null
}

export type AdminTaskInputs = {
  queue: Pick<AdminQueueData, 'createEscrowItems' | 'releaseFallbackItems'>
  pendingVerificationProfiles: AdminTaskEntity[]
  pendingVerificationCompanies: AdminTaskEntity[]
  incompleteOnboardings: AdminTaskEntity[]
  awaitingFundingDeals: AwaitingFundingDeal[]
  vaultConfigured: boolean
  vaultAlerts: { id: string; severity: string; title: string; description: string }[]
}

function ageMs(now: Date, iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  return Math.max(0, now.getTime() - then)
}

/**
 * Derives the prioritized "needs attention" inbox from authoritative
 * application state. Pure so priorities and thresholds stay unit-testable.
 * Dispute tasks are intentionally absent: dispute state lives only in the
 * escrow indexer and is appended client-side.
 */
export function buildAdminTasks(input: AdminTaskInputs, now: Date): AdminTask[] {
  const tasks: AdminTask[] = []

  if (!input.vaultConfigured) {
    tasks.push({
      id: 'vault:unconfigured',
      type: 'vault_unconfigured',
      priority: 'critical',
      titleKey: 'adminOverview.tasks.vaultUnconfiguredTitle',
      entityLabel: 'DeFindex',
      detectedAt: null,
      ageMs: null,
      stateKey: 'adminOverview.states.unconfigured',
      actionKey: 'adminOverview.actions.configureVault',
      href: '/dashboard/admin/vault',
    })
  }

  for (const alert of input.vaultAlerts) {
    if (alert.severity !== 'critical') continue
    tasks.push({
      id: `vault:alert:${alert.id}`,
      type: 'vault_alert',
      priority: 'critical',
      titleKey: 'adminOverview.tasks.vaultAlertTitle',
      titleParams: { alert: alert.title },
      entityLabel: 'DeFindex',
      detectedAt: null,
      ageMs: null,
      stateKey: 'adminOverview.states.critical',
      actionKey: 'adminOverview.actions.reviewVault',
      href: '/dashboard/admin/vault',
    })
  }

  for (const item of input.queue.createEscrowItems) {
    tasks.push({
      id: `escrow:create:${item.dealId}`,
      type: 'create_escrow',
      priority: 'high',
      titleKey: 'adminOverview.tasks.createEscrowTitle',
      titleParams: { deal: item.dealTitle },
      entityLabel: item.pymeName,
      detectedAt: item.createdAt ?? null,
      ageMs: ageMs(now, item.createdAt),
      stateKey: 'adminOverview.states.orderConfirmed',
      actionKey: 'adminOverview.actions.createEscrow',
      href: '/dashboard/admin/approvals',
    })
  }

  for (const item of input.queue.releaseFallbackItems) {
    tasks.push({
      id: `escrow:release:${item.milestoneId}`,
      type: 'milestone_release',
      priority: 'high',
      titleKey: 'adminOverview.tasks.milestoneReleaseTitle',
      titleParams: { deal: item.dealTitle, milestone: item.milestoneTitle },
      entityLabel: item.dealTitle,
      detectedAt: item.completedAt,
      ageMs: ageMs(now, item.completedAt),
      stateKey: 'adminOverview.states.readyToRelease',
      actionKey: 'adminOverview.actions.releaseFunds',
      href: '/dashboard/admin/releases',
    })
  }

  const staleThresholdMs = STALE_ESCROW_HOURS * 60 * 60 * 1000
  for (const deal of input.awaitingFundingDeals) {
    const age = ageMs(now, deal.updatedAt)
    const stale = age != null && age > staleThresholdMs
    tasks.push({
      id: `escrow:funding:${deal.id}`,
      type: stale ? 'stale_escrow' : 'escrow_awaiting_funding',
      priority: stale ? 'high' : 'normal',
      titleKey: stale
        ? 'adminOverview.tasks.staleEscrowTitle'
        : 'adminOverview.tasks.awaitingFundingTitle',
      titleParams: { deal: deal.title },
      entityLabel: deal.title,
      detectedAt: deal.updatedAt,
      ageMs: age,
      stateKey:
        deal.repaymentStatus === 'escrow_initialized'
          ? 'adminOverview.states.escrowInitialized'
          : 'adminOverview.states.funding',
      actionKey: stale
        ? 'adminOverview.actions.investigateEscrow'
        : 'adminOverview.actions.viewDeal',
      href: `/deals/${deal.id}`,
    })
  }

  for (const profile of input.pendingVerificationProfiles) {
    tasks.push({
      id: `verify:profile:${profile.id}`,
      type: 'pending_verification',
      priority: 'normal',
      titleKey: 'adminOverview.tasks.verifyProfileTitle',
      titleParams: { name: profile.name },
      entityLabel: profile.name,
      detectedAt: profile.createdAt,
      ageMs: ageMs(now, profile.createdAt),
      stateKey: 'adminOverview.states.unverified',
      actionKey: 'adminOverview.actions.reviewUser',
      href: `/dashboard/admin/users/${profile.id}`,
    })
  }

  for (const company of input.pendingVerificationCompanies) {
    tasks.push({
      id: `verify:company:${company.id}`,
      type: 'pending_verification',
      priority: 'normal',
      titleKey: 'adminOverview.tasks.verifyCompanyTitle',
      titleParams: { name: company.name },
      entityLabel: company.name,
      detectedAt: company.createdAt,
      ageMs: ageMs(now, company.createdAt),
      stateKey: 'adminOverview.states.unverified',
      actionKey: 'adminOverview.actions.reviewCompany',
      href: '/dashboard/admin/users?role=supplier',
    })
  }

  const onboardingThresholdMs = STALE_ONBOARDING_DAYS * 24 * 60 * 60 * 1000
  for (const profile of input.incompleteOnboardings) {
    const age = ageMs(now, profile.createdAt)
    if (age == null || age <= onboardingThresholdMs) continue
    tasks.push({
      id: `onboarding:${profile.id}`,
      type: 'incomplete_onboarding',
      priority: 'informational',
      titleKey: 'adminOverview.tasks.incompleteOnboardingTitle',
      titleParams: { name: profile.name },
      entityLabel: profile.name,
      detectedAt: profile.createdAt,
      ageMs: age,
      stateKey: 'adminOverview.states.onboardingIncomplete',
      actionKey: 'adminOverview.actions.reviewUser',
      href: `/dashboard/admin/users/${profile.id}`,
    })
  }

  tasks.sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (byPriority !== 0) return byPriority
    return (b.ageMs ?? -1) - (a.ageMs ?? -1)
  })

  return tasks
}
