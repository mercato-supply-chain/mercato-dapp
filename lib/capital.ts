import { Deal, CapitalState } from './types'

/**
 * Derives a CapitalState model from an array of Deal objects.
 * This ensures all balance calculations follow a unified business logic.
 */
export function calculateCapitalState(deals: Deal[], assetCode: string = 'USDC'): CapitalState {
  const now = new Date().toISOString()
  
  let totalCapital = 0
  let lockedCapital = 0
  let availableCapital = 0
  let releasedCapital = 0

  deals.forEach((deal) => {
    const amount = Number(deal.priceUSDC || 0)
    
    // 1. Total Capital: All funds committed to or through the platform
    // For this context, we consider any deal that was funded as part of total capital
    if (deal.status !== 'awaiting_funding' && deal.status !== 'disputed') {
       totalCapital += amount
    }

    // 2. Locked Capital: Currently held in escrow (funded but not fully released)
    if (deal.status === 'funded' || deal.status === 'in_progress' || deal.status === 'milestone_pending') {
      lockedCapital += amount
    }

    // 3. Available Capital: Seeking funding
    if (deal.status === 'awaiting_funding') {
      availableCapital += amount
    }

    // 4. Released Capital: Successfully paid out to suppliers
    if (deal.status === 'released' || deal.status === 'completed') {
      releasedCapital += amount
    }
  })

  return {
    assetCode,
    totalCapital,
    lockedCapital,
    availableCapital,
    releasedCapital,
    updatedAt: now,
  }
}

/**
 * Calculates derived metrics from a CapitalState.
 */
export function getCapitalMetrics(state: CapitalState) {
  const utilizationRate = state.totalCapital > 0 
    ? (state.lockedCapital / state.totalCapital) * 100 
    : 0

  return {
    utilizationRate,
    isHealthy: state.availableCapital >= 0,
  }
}
