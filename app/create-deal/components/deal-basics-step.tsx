'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { getCategoryLabel } from '@/lib/categories'
import type { CreateDealFormData } from '../types'

interface SupplierOption {
  id: string
  company_name: string
  email?: string
  address?: string
}

interface ProductOption {
  id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
}

interface DealBasicsStepProps {
  formData: Pick<
    CreateDealFormData,
    'category' | 'supplierId' | 'productId' | 'description' | 'quantity'
  >
  availableCategories: string[]
  filteredSuppliers: SupplierOption[]
  productsForSupplier: ProductOption[]
  totalAmount: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
  onSupplierSelect: (supplierId: string) => void
}

export function DealBasicsStep({
  formData,
  availableCategories,
  filteredSuppliers,
  productsForSupplier,
  totalAmount,
  onUpdate,
  onSupplierSelect,
}: DealBasicsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" aria-hidden />
          Deal Basics
        </CardTitle>
        <CardDescription>
          Choose a category, supplier, and product; price comes from the supplier catalog
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => onUpdate('category', v)}
          >
            <SelectTrigger id="category">
              <SelectValue
                placeholder={
                  availableCategories.length > 0
                    ? 'Select category'
                    : 'No categories available yet'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No products in catalog yet. Ask suppliers to add products in
                  their profile.
                </div>
              ) : (
                availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <Select
            value={formData.supplierId}
            onValueChange={(v) => {
              onSupplierSelect(v)
            }}
          >
            <SelectTrigger id="supplier">
              <SelectValue
                placeholder={
                  filteredSuppliers.length > 0
                    ? 'Select supplier'
                    : 'Select a category first or no suppliers available'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredSuppliers.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No suppliers with products in this category
                </div>
              ) : (
                filteredSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.company_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product">Product</Label>
          <Select
            value={formData.productId}
            onValueChange={(v) => onUpdate('productId', v)}
          >
            <SelectTrigger id="product">
              <SelectValue
                placeholder={
                  productsForSupplier.length > 0
                    ? 'Select product'
                    : 'Select a supplier first'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {productsForSupplier.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No products for this supplier
                </div>
              ) : (
                productsForSupplier.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.price_per_unit)} USDC/unit
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 500"
            value={formData.quantity}
            onChange={(e) => onUpdate('quantity', e.target.value)}
            aria-required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            name="description"
            autoComplete="off"
            placeholder="Brief description or notes for this order…"
            value={formData.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            rows={3}
          />
        </div>

        {totalAmount > 0 && (
          <div className="rounded-lg border border-accent bg-accent/5 p-4">
            <p className="text-sm text-muted-foreground">Total Deal Amount</p>
            <p className="text-3xl font-bold text-accent tabular-nums">
              {formatCurrency(totalAmount)} USDC
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
