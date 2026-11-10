import { afterEach, expect, test } from 'bun:test'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'

afterEach(() => {
  document.body.replaceChildren()
})

test('ThemeProvider does not emit a client script-tag warning', async () => {
  const errors: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
  }

  const rootEl = document.createElement('div')
  document.body.append(rootEl)
  const root = createRoot(rootEl)
  root.render(
    createElement(ThemeProvider, { attribute: 'class', defaultTheme: 'system' }, 'ok'),
  )
  await Promise.resolve()
  root.unmount()
  console.error = original

  expect(errors.some((msg) => msg.includes('Encountered a script tag'))).toBe(false)
})
