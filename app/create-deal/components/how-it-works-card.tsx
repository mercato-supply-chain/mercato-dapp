'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  'Create your deal with product details and payment terms',
  'Escrow smart contract is deployed to Stellar',
  'Investors fund your deal through the marketplace',
  'Supplier ships and gets paid in milestones',
] as const

export function HowItWorksCard() {
  return (
    <Card className="border-accent">
      <CardHeader>
        <CardTitle className="text-base">How It Works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {steps.map((text, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {i + 1}
            </div>
            <p className="text-muted-foreground">{text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
