/**
 * Format date to a consistent string format for both server and client
 * Prevents hydration mismatches by avoiding locale-dependent formatting
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${month}/${day}/${year}`
}

/**
 * Format date to a more readable format
 */
export function formatDateLong(dateString: string): string {
  const date = new Date(dateString)
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}
