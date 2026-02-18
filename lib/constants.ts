/**
 * LATAM countries for supplier/PYME profile (Settings and directory).
 * Ordered for common use; display names in English.
 */
export const LATAM_COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'Mexico' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panama' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Peru' },
  { value: 'DO', label: 'Dominican Republic' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
] as const

/**
 * Industry sectors for suppliers and PYMEs (LATAM marketplace).
 */
export const SECTORS = [
  { value: 'food-manufacturing', label: 'Food Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'textiles-apparel', label: 'Textiles & Apparel' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'construction', label: 'Construction' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'machinery-equipment', label: 'Machinery & Equipment' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'raw-materials', label: 'Raw Materials' },
  { value: 'healthcare-pharma', label: 'Healthcare & Pharma' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'other', label: 'Other' },
] as const

export function getCountryLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = LATAM_COUNTRIES.find((c) => c.value === value)
  return found ? found.label : value
}

export function getSectorLabel(value: string | null | undefined): string {
  if (!value) return ''
  const found = SECTORS.find((s) => s.value === value)
  return found ? found.label : value
}
