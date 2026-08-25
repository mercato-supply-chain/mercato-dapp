import { Badge } from '@/components/ui/badge'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'

const STATE_VARIANT: Record<
  SupplierCommercialState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  financing_request: 'secondary',
  expired: 'outline',
  cancelled: 'destructive',
  financed_sale: 'default',
  needs_shipment: 'default',
  in_fulfillment: 'secondary',
  completed_sale: 'outline',
}

type CommercialStatusBadgeProps = {
  state: SupplierCommercialState
  label: string
}

export function CommercialStatusBadge({ state, label }: CommercialStatusBadgeProps) {
  return (
    <Badge variant={STATE_VARIANT[state]} className="whitespace-nowrap">
      {label}
    </Badge>
  )
}
