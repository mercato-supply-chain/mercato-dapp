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
import { formatCategoryLabel } from '../types'
import type { CreateDealFormData } from '../types'

interface DealBasicsStepProps {
  formData: Pick<
    CreateDealFormData,
    'productName' | 'description' | 'category' | 'quantity' | 'pricePerUnit'
  >
  availableCategories: string[]
  totalAmount: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
}

export function DealBasicsStep({
  formData,
  availableCategories,
  totalAmount,
  onUpdate,
}: DealBasicsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" aria-hidden />
          Deal Basics
        </CardTitle>
        <CardDescription>
          Provide details about the product you need to purchase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="productName">Product Name</Label>
          <Input
            id="productName"
            name="productName"
            autoComplete="off"
            placeholder="e.g., Industrial LED Lighting Equipment…"
            value={formData.productName}
            onChange={(e) => onUpdate('productName', e.target.value)}
            aria-required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            autoComplete="off"
            placeholder="Brief description of the product and its intended use…"
            value={formData.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            rows={3}
          />
        </div>

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
                  No suppliers have added categories yet. Ask suppliers to add
                  their products & categories in their profile.
                </div>
              ) : (
                availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {formatCategoryLabel(cat)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {availableCategories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Categories shown are from suppliers who have added them to their
              profile
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              placeholder="500"
              value={formData.quantity}
              onChange={(e) => onUpdate('quantity', e.target.value)}
              aria-required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricePerUnit">Price per Unit (USDC)</Label>
            <Input
              id="pricePerUnit"
              name="pricePerUnit"
              type="number"
              inputMode="decimal"
              placeholder="90.00"
              value={formData.pricePerUnit}
              onChange={(e) => onUpdate('pricePerUnit', e.target.value)}
              aria-required
            />
          </div>
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
