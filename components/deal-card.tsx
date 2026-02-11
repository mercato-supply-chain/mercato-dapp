import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Deal } from '@/lib/types'
import { Clock, Package, TrendingUp, Building2 } from 'lucide-react'

interface DealCardProps {
  deal: Deal
}

const statusConfig = {
  awaiting_funding: { label: 'Open for Funding', variant: 'default' as const, color: 'text-accent' },
  funded: { label: 'Funded', variant: 'secondary' as const, color: 'text-success' },
  in_progress: { label: 'In Progress', variant: 'secondary' as const, color: 'text-warning' },
  milestone_pending: { label: 'Milestone Pending', variant: 'secondary' as const, color: 'text-warning' },
  completed: { label: 'Completed', variant: 'outline' as const, color: 'text-muted-foreground' },
  disputed: { label: 'Disputed', variant: 'destructive' as const, color: 'text-destructive' },
  released: { label: 'Released', variant: 'outline' as const, color: 'text-success' },
}

export function DealCard({ deal }: DealCardProps) {
  const status = statusConfig[deal.status]
  
  return (
    <Card className="group transition-all hover:shadow-lg hover:border-accent/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={status.variant} className={status.color}>
                {status.label}
              </Badge>
              {deal.category && (
                <Badge variant="outline" className="text-xs">
                  {deal.category}
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl group-hover:text-accent transition-colors">
              {deal.productName}
            </CardTitle>
            <CardDescription className="mt-1.5">
              {deal.description || `${deal.quantity} units from ${deal.supplier}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Deal Amount</p>
              <p className="text-2xl font-bold">${deal.priceUSDC.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">USDC</p>
            </div>
            
            {deal.yieldAPR && deal.status === 'awaiting_funding' && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Yield APR</p>
                <p className="text-2xl font-bold text-success">{deal.yieldAPR}%</p>
                <p className="text-xs text-muted-foreground">{deal.term} days</p>
              </div>
            )}
          </div>

          {/* Deal Details */}
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">PyME</p>
                <p className="font-medium">{deal.pymeName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-medium">{deal.quantity} units</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Term</p>
                <p className="font-medium">{deal.term} days</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Supplier</p>
                <p className="font-medium truncate">{deal.supplier}</p>
              </div>
            </div>
          </div>

          {/* Milestones Progress */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Milestones</span>
              <span className="font-medium">
                {deal.milestones.filter(m => m.status === 'completed').length} / {deal.milestones.length}
              </span>
            </div>
            <div className="flex gap-1">
              {deal.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    milestone.status === 'completed' 
                      ? 'bg-success' 
                      : milestone.status === 'disputed'
                      ? 'bg-destructive'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <Button asChild className="w-full">
            <Link href={`/deals/${deal.id}`}>
              View Deal Details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
