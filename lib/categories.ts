/**
 * Standard product categories for the supplier catalog.
 * Used in supplier profile (add/edit product) and displayed in create-deal.
 * Stored as lowercase with hyphens; labels are for display.
 */
export const PRODUCT_CATEGORIES = [
  { value: 'food-beverage', label: 'Food & Beverage' },
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'equipment-machinery', label: 'Equipment & Machinery' },
  { value: 'raw-materials', label: 'Raw Materials' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'textiles-apparel', label: 'Textiles & Apparel' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'office-supplies', label: 'Office Supplies' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'construction', label: 'Construction' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'other', label: 'Other' },
] as const

export type ProductCategoryValue = (typeof PRODUCT_CATEGORIES)[number]['value']

export function getCategoryLabel(value: string): string {
  const found = PRODUCT_CATEGORIES.find((c) => c.value === value)
  return found ? found.label : value
}
