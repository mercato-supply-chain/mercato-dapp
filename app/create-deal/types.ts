export type FormStep = 1 | 2 | 3

export interface CreateDealProfile {
  id: string
  address?: string | null
  [key: string]: unknown
}

/** Product from supplier catalog (supplier_products table) */
export interface SupplierProductRow {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
  supplier?: {
    id: string
    company_name?: string
    email?: string
    address?: string
  } | null
}

export interface CreateDealSupplier {
  id: string
  company_name: string
  address?: string | null
  email?: string | null
  categories?: string[] | null
  products?: string[] | null
}

/** Payment milestone row in the create-deal form (percentages must sum to 100). */
export interface MilestoneDraft {
  name: string
  percentage: string
}

export interface CreateDealFormData {
  category: string
  supplierId: string
  supplierName: string
  supplierContact: string
  productId: string
  description: string
  quantity: string
  term: string
  fundingWindowDays: string
  /** Extra APR percentage points on top of the base rate (optional, 0–10) */
  yieldBonusApr: string
  milestones: MilestoneDraft[]
}

export const DEFAULT_FORM_DATA: CreateDealFormData = {
  category: '',
  supplierId: '',
  supplierName: '',
  supplierContact: '',
  productId: '',
  description: '',
  quantity: '',
  term: '60',
  fundingWindowDays: '7',
  yieldBonusApr: '0',
  milestones: [
    { name: 'Shipment Confirmation', percentage: '50' },
    { name: 'Delivery Confirmation', percentage: '50' },
  ],
}

export const MAX_MILESTONES = 8
export const MIN_MILESTONES = 2

/** Equal integer split of 100% across n milestones (e.g. 3 → 34, 33, 33). */
export function equalMilestonePercentages(n: number): string[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n)
  const rem = 100 - base * n
  return Array.from({ length: n }, (_, i) => String(base + (i < rem ? 1 : 0)))
}

export function sumMilestonePercentages(milestones: MilestoneDraft[]): number {
  return milestones.reduce((s, m) => {
    const v = m.percentage.trim()
    if (v === '') return s
    return s + Number(v)
  }, 0)
}

export function isMilestonesValid(milestones: MilestoneDraft[]): boolean {
  if (milestones.length < MIN_MILESTONES || milestones.length > MAX_MILESTONES)
    return false
  if (!milestones.every((m) => m.name.trim())) return false
  if (!milestones.every((m) => m.percentage.trim() !== '')) return false
  return Math.abs(sumMilestonePercentages(milestones) - 100) < 0.0001
}

export function formatCategoryLabel(cat: string): string {
  return cat
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
