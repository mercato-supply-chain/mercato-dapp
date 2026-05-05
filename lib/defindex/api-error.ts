export function defindexErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.length) return msg
  }
  if (typeof error === 'string' && error.length) return error
  return 'DeFindex request failed'
}
