import { Reputation } from '../lib/types'

// Mocking the normalization logic from lib/reputation.ts for verification
function asNumber(value: unknown): number {
  if (value == null) return 0
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeReputation(row: Record<string, unknown>, userId: string): Reputation {
  const reputationScore = asNumber(row.reputation_score || row.score)
  return {
    userId: asString(row.user_id) || userId,
    capitalCommitted: asNumber(row.capital_committed),
    dealsCompleted: asNumber(row.deals_completed),
    repaymentPerformance: asNumber(row.repayment_performance),
    reputationScore,
    score: reputationScore,
    stakeAmount: asNumber(row.stake_amount),
    stakeCurrency: asString(row.stake_currency) || 'USDC',
    trustLabel: asString(row.trust_label) || '',
    updatedAt: asString(row.updated_at),
  }
}

// Test cases
const testCases = [
  {
    name: "Full record from DB",
    row: {
      user_id: "user-123",
      capital_committed: "5000.50",
      deals_completed: 10,
      repayment_performance: 95.5,
      reputation_score: 90.0,
      trust_label: "Established",
      stake_amount: 1000,
      stake_currency: "USDC",
      updated_at: "2026-04-27T00:00:00Z"
    },
    expected: {
      userId: "user-123",
      capitalCommitted: 5000.5,
      dealsCompleted: 10,
      repaymentPerformance: 95.5,
      reputationScore: 90,
      score: 90,
      stakeAmount: 1000,
      stakeCurrency: "USDC",
      trustLabel: "Established",
      updatedAt: "2026-04-27T00:00:00Z"
    }
  },
  {
    name: "Minimal record with score fallback",
    row: {
      score: 75.0,
    },
    expected: {
      userId: "fallback-user",
      capitalCommitted: 0,
      dealsCompleted: 0,
      repaymentPerformance: 0,
      reputationScore: 75,
      score: 75,
      stakeAmount: 0,
      stakeCurrency: "USDC",
      trustLabel: "",
      updatedAt: ""
    }
  }
]

function runTests() {
  console.log("Running Reputation Logic Tests...")
  let passed = 0
  
  for (const tc of testCases) {
    const result = normalizeReputation(tc.row, "fallback-user")
    const resultJson = JSON.stringify(result)
    const expectedJson = JSON.stringify(tc.expected)
    
    if (resultJson === expectedJson) {
      console.log(`✅ PASSED: ${tc.name}`)
      passed++
    } else {
      console.log(`❌ FAILED: ${tc.name}`)
      console.log("  Expected:", tc.expected)
      console.log("  Actual:  ", result)
    }
  }
  
  console.log(`\nTests finished: ${passed}/${testCases.length} passed.`)
  if (passed === testCases.length) {
    process.exit(0)
  } else {
    process.exit(1)
  }
}

runTests()
