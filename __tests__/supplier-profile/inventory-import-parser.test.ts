import { describe, expect, it } from 'bun:test'
import * as XLSX from 'xlsx'
import {
  applyColumnMapping,
  autoMapHeaders,
  computeImportSummary,
  IMPORT_MAX_FILE_SIZE_BYTES,
  IMPORT_MAX_ROWS,
  parseFile,
  validateImportRows,
} from '@/lib/supplier-profile/inventory-import-parser'

describe('inventory-import-parser', () => {
  describe('parseFile - CSV', () => {
    it('parses valid CSV data and extracts headers and rows', async () => {
      const csvData = `name,category,price_per_unit,sku,stock_quantity\nProduct A,Electronics,49.99,SKU-A,100\nProduct B,Hardware,15.50,SKU-B,50`
      const file = new File([csvData], 'catalog.csv', { type: 'text/csv' })

      const result = await parseFile(file)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.headers).toEqual(['name', 'category', 'price_per_unit', 'sku', 'stock_quantity'])
      expect(result.rows.length).toBe(2)
      expect(result.rows[0].raw.name).toBe('Product A')
      expect(result.rows[0].raw.sku).toBe('SKU-A')
      expect(result.rows[1].raw.name).toBe('Product B')
      expect(result.rows[1].sourceRow).toBe(2)
    })

    it('enforces maximum row limit on CSV files (> 1,000 rows)', async () => {
      const header = 'name,category,price_per_unit\n'
      const rows = Array.from({ length: 1200 }, (_, i) => `Item ${i},Tools,9.99`).join('\n')
      const file = new File([header + rows], 'huge.csv', { type: 'text/csv' })

      const result = await parseFile(file)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.rows.length).toBe(IMPORT_MAX_ROWS)
      expect(result.rows[0].sourceRow).toBe(1)
      expect(result.rows[999].sourceRow).toBe(1000)
    })

    it('rejects files exceeding IMPORT_MAX_FILE_SIZE_BYTES (5 MB)', async () => {
      const bigBuffer = new Uint8Array(IMPORT_MAX_FILE_SIZE_BYTES + 10)
      const file = new File([bigBuffer], 'oversized.csv', { type: 'text/csv' })

      const result = await parseFile(file)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('parse.fileTooLarge')
    })

    it('aborts when AbortSignal is already triggered or triggered during parsing', async () => {
      const csvData = 'name,category,price\nItem 1,Cat 1,10'
      const file = new File([csvData], 'items.csv', { type: 'text/csv' })

      const ac = new AbortController()
      ac.abort()

      const result = await parseFile(file, ac.signal)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('parse.aborted')
    })

    it('rejects unsupported file formats', async () => {
      const file = new File(['{}'], 'data.json', { type: 'application/json' })

      const result = await parseFile(file)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('parse.unsupportedFileType')
    })
  })

  describe('parseFile - XLSX', () => {
    it('parses valid XLSX workbook correctly', async () => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['name', 'category', 'price_per_unit', 'sku'],
        ['Industrial Sensor', 'Electronics', '125.00', 'SENS-01'],
        ['Hydraulic Valve', 'Industrial', '350.50', 'VLV-99'],
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const file = new File([buf], 'products.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const result = await parseFile(file)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.headers).toEqual(['name', 'category', 'price_per_unit', 'sku'])
      expect(result.rows.length).toBe(2)
      expect(result.rows[0].raw.name).toBe('Industrial Sensor')
      expect(result.rows[0].raw.sku).toBe('SENS-01')
      expect(result.rows[1].raw.price_per_unit).toBe('350.50')
    })

    it('handles empty XLSX workbook', async () => {
      const ws = XLSX.utils.aoa_to_sheet([])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'EmptySheet')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const file = new File([buf], 'empty.xlsx')

      const result = await parseFile(file)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(['parse.xlsxEmpty', 'parse.xlsxNoRows', 'parse.xlsxParseError']).toContain(result.error)
    })
  })

  describe('autoMapHeaders & applyColumnMapping', () => {
    it('auto-maps canonical English and Spanish column headers', () => {
      const headers = ['Nombre', 'Categoría', 'Precio por unidad', 'Código', 'Cantidad']
      const mapping = autoMapHeaders(headers)

      expect(mapping['Nombre']).toBe('name')
      expect(mapping['Categoría']).toBe('category')
      expect(mapping['Precio por unidad']).toBe('price_per_unit')
      expect(mapping['Código']).toBe('sku')
      expect(mapping['Cantidad']).toBe('stock_quantity')
    })

    it('applies column mapping onto raw rows', () => {
      const rawRows = [
        {
          sourceRow: 1,
          raw: {
            'Product Name': 'Solar Inverter',
            'Type': 'Energy',
            'Unit Price': '899.99',
            'Code': 'INV-400',
          },
        },
      ]
      const mapping = autoMapHeaders(['Product Name', 'Type', 'Unit Price', 'Code'])
      const mapped = applyColumnMapping(rawRows, mapping)

      expect(mapped[0].mapped?.name).toBe('Solar Inverter')
      expect(mapped[0].mapped?.category).toBe('Energy')
      expect(mapped[0].mapped?.price_per_unit).toBe('899.99')
      expect(mapped[0].mapped?.sku).toBe('INV-400')
    })
  })

  describe('validateImportRows & computeImportSummary', () => {
    it('identifies valid rows, duplicate in file, duplicate in store, and summary counts', () => {
      const rawRows = [
        // Valid row 1
        {
          sourceRow: 1,
          raw: {},
          mapped: {
            name: 'Item Alpha',
            category: 'Materials',
            price_per_unit: '10.00',
            sku: 'SKU-ALPHA',
            description: '',
            minimum_order: '',
            delivery_time: '',
            unit: '',
            stock_quantity: '20',
            reorder_point: '',
          },
        },
        // Duplicate SKU in file
        {
          sourceRow: 2,
          raw: {},
          mapped: {
            name: 'Item Alpha Duplicate',
            category: 'Materials',
            price_per_unit: '12.00',
            sku: 'sku-alpha', // case-insensitive duplicate in file
            description: '',
            minimum_order: '',
            delivery_time: '',
            unit: '',
            stock_quantity: '10',
            reorder_point: '',
          },
        },
        // Duplicate SKU in store
        {
          sourceRow: 3,
          raw: {},
          mapped: {
            name: 'Item Beta',
            category: 'Materials',
            price_per_unit: '15.00',
            sku: 'SKU-EXISTING-STORE',
            description: '',
            minimum_order: '',
            delivery_time: '',
            unit: '',
            stock_quantity: '5',
            reorder_point: '',
          },
        },
        // Invalid row (missing price)
        {
          sourceRow: 4,
          raw: {},
          mapped: {
            name: 'Item Gamma',
            category: 'Materials',
            price_per_unit: 'invalid-price',
            sku: 'SKU-GAMMA',
            description: '',
            minimum_order: '',
            delivery_time: '',
            unit: '',
            stock_quantity: '',
            reorder_point: '',
          },
        },
      ]

      const existingSkus = new Set(['SKU-EXISTING-STORE'])
      const validated = validateImportRows(rawRows, existingSkus)

      expect(validated[0].valid).toBe(true)
      expect(validated[0].importable).toBe(true)

      expect(validated[1].valid).toBe(true)
      expect(validated[1].duplicateInFile).toBe(true)
      expect(validated[1].importable).toBe(false)

      expect(validated[2].valid).toBe(true)
      expect(validated[2].duplicateInStore).toBe(true)
      expect(validated[2].importable).toBe(false)

      expect(validated[3].valid).toBe(false)
      expect(validated[3].importable).toBe(false)

      const summary = computeImportSummary(validated)
      expect(summary.total).toBe(4)
      expect(summary.importable).toBe(1)
      expect(summary.duplicateInFile).toBe(1)
      expect(summary.duplicateInStore).toBe(1)
      expect(summary.invalid).toBe(1)
    })
  })
})
