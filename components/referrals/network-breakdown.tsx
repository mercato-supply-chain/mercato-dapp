import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReferralNetworkBreakdown } from '@/lib/referrals/get-supplier-referral-dashboard'

type Labels = {
  title: string
  country: string
  sector: string
  count: string
}

type Props = {
  network: ReferralNetworkBreakdown
  labels: Labels
  countryLabels: Record<string, string>
  sectorLabels: Record<string, string>
}

export function ReferralNetworkBreakdownTables({
  network,
  labels,
  countryLabels,
  sectorLabels,
}: Props) {
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{labels.country}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.country}</TableHead>
                <TableHead className="text-right">{labels.count}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {network.byCountry.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{countryLabels[row.key] ?? row.key}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{labels.sector}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.sector}</TableHead>
                <TableHead className="text-right">{labels.count}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {network.bySector.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{sectorLabels[row.key] ?? row.key}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
