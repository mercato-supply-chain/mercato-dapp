export type RetryPolicy = {
  indexerEmptyMilestones: { extraAttempts: number; delayMs: number }
  pollarContractLookup: { attempts: number; delayMs: number }
  afterCommandMs: {
    fund: number
    approve: number
    release: number
    addMilestone: number
    dispute: number
    resolveDispute: number
    approveAndRelease: number
  }
}

/** Matches the delays previously hardcoded in `useRepaymentEscrow`. */
export const DEFAULT_REPAYMENT_RETRY_POLICY: RetryPolicy = {
  indexerEmptyMilestones: { extraAttempts: 2, delayMs: 2000 },
  pollarContractLookup: { attempts: 5, delayMs: 3000 },
  afterCommandMs: {
    fund: 1500,
    approve: 1000,
    release: 1500,
    addMilestone: 1500,
    dispute: 1500,
    resolveDispute: 1500,
    approveAndRelease: 1500,
  },
}

export type WaitFn = (ms: number) => Promise<void>

export const defaultWait: WaitFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
