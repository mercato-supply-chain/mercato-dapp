import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

afterEach(() => {
  cleanup()
})

describe('root skip link and document color-scheme (#286)', () => {
  test('app/layout.tsx renders a single :focus-visible skip link targeting #main before AppProviders', () => {
    const layout = readRepoFile('app/layout.tsx')

    expect(layout).toContain('href="#main"')
    expect(layout).toContain('Skip to content')
    expect(layout).toContain('focus-visible:not-sr-only')

    const skipIndex = layout.indexOf('href="#main"')
    const providersIndex = layout.indexOf('<AppProviders')
    expect(skipIndex).toBeGreaterThan(-1)
    expect(providersIndex).toBeGreaterThan(skipIndex)
  })

  test('app/globals.css sets color-scheme: light in :root and color-scheme: dark in .dark', () => {
    const css = readRepoFile('app/globals.css')

    expect(css).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*light;/)
    expect(css).toMatch(/\.dark\s*\{[\s\S]*?color-scheme:\s*dark;/)
  })

  test('public and app routes provide matching <main id="main" tabIndex={-1}> landmarks without duplicate skip links', () => {
    const landmarkFiles = [
      'app/page.tsx',
      'app/deals/deals-browse.tsx',
      'app/create-deal/create-deal-content.tsx',
      'app/suppliers/page.tsx',
      'app/investors/page.tsx',
      'app/pymes/page.tsx',
      'app/settings/page.tsx',
      'app/how-it-works/how-it-works-view.tsx',
      'app/deals/[id]/deal-detail-view.tsx',
      'components/our-story/our-story-view.tsx',
      'components/blog/blog-views.tsx',
      'components/events/event-page.tsx',
    ]

    for (const file of landmarkFiles) {
      expect(readRepoFile(file)).toContain('<main id="main" tabIndex={-1}')
    }

    expect(readRepoFile('app/create-deal/create-deal-content.tsx')).not.toContain('Skip to main content')
  })

  test('first Tab focuses "Skip to content" and main#main accepts programmatic focus', async () => {
    const user = userEvent.setup()

    render(
      createElement(
        'div',
        null,
        createElement(
          'a',
          {
            href: '#main',
            className:
              'sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100]',
          },
          'Skip to content',
        ),
        createElement('header', null, createElement('a', { href: '/deals' }, 'Deals')),
        createElement(
          'main',
          { id: 'main', tabIndex: -1 },
          createElement('button', { type: 'button' }, 'Main action'),
        ),
      ),
    )

    await user.tab()

    const skipLink = screen.getByRole('link', { name: 'Skip to content' })
    expect(document.activeElement).toBe(skipLink)
    expect(skipLink.getAttribute('href')).toBe('#main')

    const mainEl = document.getElementById('main')
    expect(mainEl).not.toBeNull()
    mainEl!.focus()
    expect(document.activeElement).toBe(mainEl)
  })
})
