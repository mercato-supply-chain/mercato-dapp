import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { SupplierInventoryImportDialog } from '@/components/supplier-profile/supplier-inventory-import-dialog'
import { enDict } from '@/lib/i18n/dictionaries'
import type { SupplierProduct } from '@/lib/supplier-profile/types'

let parseFileMock: ReturnType<typeof mock>

mock.module('@/lib/supplier-profile/inventory-import-parser', () => ({
  parseFile: (...args: unknown[]) => parseFileMock(...args),
  autoMapHeaders: () => ({}),
  applyColumnMapping: (rows: unknown) => rows,
  validateImportRows: (rows: Array<{ sku?: string; name?: string }>) =>
    rows.map((row) => ({
      importable: true,
      product: { sku: row.sku, name: row.name, quantity: 1 },
    })),
  computeImportSummary: (rows: unknown[]) => ({
    total: rows.length,
    importable: rows.length,
    invalid: 0,
    duplicateInFile: 0,
    duplicateInStore: 0,
  }),
}))

mock.module('@/lib/i18n/provider', () => ({
  useI18n: () => ({
    locale: 'en',
    messages: enDict,
    t: (key: string) => key,
    setLocale: () => {},
  }),
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const products: SupplierProduct[] = []

function makeFile(name: string): File {
  return new File([`${name}`], name, { type: 'text/csv' })
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('file input not found')
  return input as HTMLInputElement
}

async function selectFile(file: File) {
  const input = fileInput()
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
}

beforeEach(() => {
  parseFileMock = mock()
})

afterEach(() => {
  cleanup()
})

describe('SupplierInventoryImportDialog', () => {
  test("reversed A/B resolution keeps B's filename and B's rows together", async () => {
    const a = deferred<{ ok: true; headers: string[]; rows: Array<{ sku: string; name: string }> }>()
    const b = deferred<{ ok: true; headers: string[]; rows: Array<{ sku: string; name: string }> }>()
    parseFileMock.mockImplementationOnce(() => a.promise)
    parseFileMock.mockImplementationOnce(() => b.promise)

    render(
      <SupplierInventoryImportDialog
        open
        onOpenChange={() => {}}
        products={products}
        onImport={async () => true}
      />,
    )

    await selectFile(makeFile('a.csv'))
    await selectFile(makeFile('b.csv'))

    await act(async () => {
      b.resolve({ ok: true, headers: ['sku'], rows: [{ sku: 'B-1', name: 'product-B-1' }] })
    })
    await act(async () => {
      a.resolve({ ok: true, headers: ['sku'], rows: [{ sku: 'A-1', name: 'product-A-1' }] })
    })

    expect(screen.getByText('b.csv')).toBeTruthy()
    expect(screen.getByText(/product-B-1/)).toBeTruthy()
    expect(screen.queryByText(/product-A-1/)).toBeNull()
  })

  test('a parse finishing after close does not repopulate the reopened dialog', async () => {
    const a = deferred<{ ok: true; headers: string[]; rows: Array<{ sku: string; name: string }> }>()
    parseFileMock.mockImplementationOnce(() => a.promise)

    const { unmount } = render(
      <SupplierInventoryImportDialog
        open
        onOpenChange={() => {}}
        products={products}
        onImport={async () => true}
      />,
    )

    await selectFile(makeFile('a.csv'))
    unmount()

    await act(async () => {
      a.resolve({ ok: true, headers: ['sku'], rows: [{ sku: 'A-1', name: 'product-A-1' }] })
    })

    render(
      <SupplierInventoryImportDialog
        open
        onOpenChange={() => {}}
        products={products}
        onImport={async () => true}
      />,
    )

    expect(screen.queryByText(/product-A-1/)).toBeNull()
  })

  test('handles parser rejection consistently', async () => {
    parseFileMock.mockRejectedValue(new Error('parse failed'))

    render(
      <SupplierInventoryImportDialog
        open
        onOpenChange={() => {}}
        products={products}
        onImport={async () => true}
      />,
    )

    await selectFile(makeFile('bad.csv'))
    await waitFor(() => {
      expect(screen.getByText(/parse failed/i)).toBeTruthy()
    })
  })
})
