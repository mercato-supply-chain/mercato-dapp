'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { CreateDealFormData } from '../types'

interface MilestonesStepProps {
  formData: Pick<
    CreateDealFormData,
    | 'milestone1Name'
    | 'milestone1Percentage'
    | 'milestone2Name'
    | 'milestone2Percentage'
  >
  totalAmount: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
}

const PERCENT_OPTIONS = ['50', '40', '60'] as const

export function MilestonesStep({
  formData,
  totalAmount,
  onUpdate,
}: MilestonesStepProps) {
  const m1Amount =
    (totalAmount * Number(formData.milestone1Percentage)) / 100
  const m2Amount =
    (totalAmount * Number(formData.milestone2Percentage)) / 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Payment Milestones
        </CardTitle>
        <CardDescription>
          Define when the supplier gets paid from escrow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex gap-3">
            <Info
              className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Standard Milestone Structure
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Most deals use a 50/50 split: 50% upfront after shipment
                confirmation, and 50% after delivery confirmation. You can
                customize if needed.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="font-semibold">Milestone 1</h4>
          <div className="space-y-2">
            <Label htmlFor="milestone1Name">Milestone Name</Label>
            <Input
              id="milestone1Name"
              value={formData.milestone1Name}
              onChange={(e) => onUpdate('milestone1Name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone1Percentage">Payment Percentage</Label>
            <Select
              value={formData.milestone1Percentage}
              onValueChange={(v) => onUpdate('milestone1Percentage', v)}
            >
              <SelectTrigger id="milestone1Percentage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERCENT_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(m1Amount)} USDC
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="font-semibold">Milestone 2</h4>
          <div className="space-y-2">
            <Label htmlFor="milestone2Name">Milestone Name</Label>
            <Input
              id="milestone2Name"
              value={formData.milestone2Name}
              onChange={(e) => onUpdate('milestone2Name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone2Percentage">Payment Percentage</Label>
            <Select
              value={formData.milestone2Percentage}
              onValueChange={(v) => onUpdate('milestone2Percentage', v)}
            >
              <SelectTrigger id="milestone2Percentage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERCENT_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(m2Amount)} USDC
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
