import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Progress } from "./ui/progress"
import { CapitalState } from "@/lib/types"
import { getCapitalMetrics } from "@/lib/capital"
import { DollarSign, ShieldCheck, Clock, TrendingUp } from "lucide-react"

interface CapitalOverviewProps {
  state: CapitalState
}

/**
 * A summary card displaying aggregate capital distributions.
 * This is a usage example of the CapitalState model from Issue #4.
 */
export function CapitalOverview({ state }: CapitalOverviewProps) {
  const metrics = getCapitalMetrics(state)
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          Capital Distribution ({state.assetCode})
        </CardTitle>
        <CardDescription>
          Real-time summary of locked, available, and released liquidity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Total Under Management</p>
            <p className="text-2xl font-bold">${state.totalCapital.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Locked in Escrow</p>
            <p className="text-2xl font-bold text-amber-500">${state.lockedCapital.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Available for Deals</p>
            <p className="text-2xl font-bold text-emerald-500">${state.availableCapital.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Successfully Released</p>
            <p className="text-2xl font-bold text-blue-500">${state.releasedCapital.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="pt-2">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Capital Utilization
            </span>
            <span className="font-semibold">{metrics.utilizationRate.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.utilizationRate} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}
