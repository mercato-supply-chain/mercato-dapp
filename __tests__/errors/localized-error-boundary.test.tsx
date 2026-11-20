import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { LocalizedErrorBoundary } from '@/components/errors/localized-error-boundary'
import DashboardError from '@/app/dashboard/error'
import SuppliersError from '@/app/suppliers/error'
import PymesError from '@/app/pymes/error'

// Mock i18n provider
mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const messages: Record<string, string> = {
        'errorBoundary.title': 'Something went wrong',
        'errorBoundary.description': 'An unexpected error occurred while loading this section.',
        'errorBoundary.retry': 'Try again',
        'errorBoundary.dashboardTitle': 'Unable to load dashboard',
        'errorBoundary.dashboardDescription': 'The dashboard data could not be loaded. Please try again.',
        'errorBoundary.directoryTitle': 'Unable to load directory',
        'errorBoundary.directoryDescription': 'The directory listings could not be loaded. Please try again.',
        'errorBoundary.diagnosticLabel': 'Error reference',
      }
      return messages[key] ?? key
    },
  }),
}))

describe('LocalizedErrorBoundary', () => {
  test('renders accessible alert role and live region', () => {
    const reset = mock(() => {})
    const error = new Error('Secret database connection string: postgres://admin:password@db.internal')

    render(<LocalizedErrorBoundary error={error} reset={reset} />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })

  test('does not expose raw exception message or sensitive details', () => {
    const reset = mock(() => {})
    const sensitiveMessage = 'SECRET_KEY_EXPOSED_IN_TRACE_12345'
    const error = new Error(sensitiveMessage)

    render(<LocalizedErrorBoundary error={error} reset={reset} />)

    expect(screen.queryByText(sensitiveMessage)).toBeNull()
  })

  test('displays safe diagnostic reference when digest is provided', () => {
    const reset = mock(() => {})
    const error = Object.assign(new Error('Internal render failure'), {
      digest: 'DIGEST_SAFE_HASH_ABC987',
    })

    render(<LocalizedErrorBoundary error={error} reset={reset} />)

    expect(screen.getByText(/DIGEST_SAFE_HASH_ABC987/)).toBeDefined()
    expect(screen.getByText(/Error reference/)).toBeDefined()
  })

  test('calls reset callback when retry button is clicked', () => {
    let recovered = false
    const reset = mock(() => {
      recovered = true
    })
    const error = new Error('Network timeout')

    render(<LocalizedErrorBoundary error={error} reset={reset} />)

    const button = screen.getByRole('button', { name: /Try again/i })
    fireEvent.click(button)

    expect(reset).toHaveBeenCalledTimes(1)
    expect(recovered).toBe(true)
  })

  test('renders custom title, description, and action label when provided', () => {
    const reset = mock(() => {})
    const error = new Error('Custom error')

    render(
      <LocalizedErrorBoundary
        error={error}
        reset={reset}
        title="Custom Title"
        description="Custom recovery instructions"
        actionLabel="Custom Action"
      />,
    )

    expect(screen.getByText('Custom Title')).toBeDefined()
    expect(screen.getByText('Custom recovery instructions')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Custom Action' })).toBeDefined()
  })
})

describe('Segment error boundaries', () => {
  test('DashboardError renders dashboard-specific recovery UI', () => {
    const reset = mock(() => {})
    const error = new Error('Failed to load portfolio metrics')

    render(<DashboardError error={error} reset={reset} />)

    expect(screen.getByText('Unable to load dashboard')).toBeDefined()
    expect(screen.getByText('The dashboard data could not be loaded. Please try again.')).toBeDefined()
  })

  test('SuppliersError renders directory-specific recovery UI', () => {
    const reset = mock(() => {})
    const error = new Error('Failed to fetch suppliers from database')

    render(<SuppliersError error={error} reset={reset} />)

    expect(screen.getByText('Unable to load directory')).toBeDefined()
    expect(screen.getByText('The directory listings could not be loaded. Please try again.')).toBeDefined()
  })

  test('PymesError renders directory-specific recovery UI', () => {
    const reset = mock(() => {})
    const error = new Error('Failed to fetch pymes')

    render(<PymesError error={error} reset={reset} />)

    expect(screen.getByText('Unable to load directory')).toBeDefined()
  })
})
