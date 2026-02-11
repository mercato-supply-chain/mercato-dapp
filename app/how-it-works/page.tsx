import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  TrendingUp,
  Users,
  ShieldCheck,
  FileText,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Lock
} from 'lucide-react'

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Badge className="mb-4" variant="secondary">
            How MERCATO Works
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Supply Chain Finance, Simplified
          </h1>
          <p className="text-lg text-muted-foreground">
            Transparent, blockchain-secured financing that connects PyMEs, investors, and suppliers
          </p>
        </div>

        {/* The Process - Step by Step */}
        <div className="mb-16">
          <h2 className="mb-8 text-center text-3xl font-bold">The Complete Flow</h2>
          
          <div className="mx-auto max-w-4xl space-y-8">
            {/* Step 1 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-foreground">
                    1
                  </div>
                  <div>
                    <CardTitle className="mb-2">PyME Creates a Deal</CardTitle>
                    <CardDescription className="text-base">
                      A business (PyME) needs to purchase inventory but lacks working capital
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>Specify product details, quantity, and supplier information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>Set payment terms (30-90 days) and milestones</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>MERCATO deploys a non-custodial escrow smart contract on Stellar</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-xl font-bold text-success-foreground">
                    2
                  </div>
                  <div>
                    <CardTitle className="mb-2">Deal Appears in Marketplace</CardTitle>
                    <CardDescription className="text-base">
                      The deal is now visible to investors seeking short-term yield opportunities
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>Status: "Awaiting Funding"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>Shows expected yield APR and deal timeline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>Full transparency: all deal details are public</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    3
                  </div>
                  <div>
                    <CardTitle className="mb-2">Investor Funds the Deal</CardTitle>
                    <CardDescription className="text-base">
                      An investor connects their Stellar wallet and funds the deal with USDC
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Uses Stellar Wallet Kit (Freighter, Lobstr, or Albedo)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Signs transaction XDR to transfer USDC to escrow contract</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Escrow becomes "Funded" — supplier is notified</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning text-xl font-bold text-warning-foreground">
                    4
                  </div>
                  <div>
                    <CardTitle className="mb-2">Supplier Ships & Provides Evidence</CardTitle>
                    <CardDescription className="text-base">
                      Supplier prepares the order and uploads proof of shipment
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>Uploads invoice, tracking number, and shipping documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>Updates Milestone 1: "Shipment Confirmation"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>All evidence stored on-chain or IPFS with hash reference</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 5 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-foreground">
                    5
                  </div>
                  <div>
                    <CardTitle className="mb-2">PyME Confirms Milestone</CardTitle>
                    <CardDescription className="text-base">
                      The PyME reviews the evidence and approves the milestone
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>PyME can approve or dispute the milestone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>If approved: 50% of escrow releases to supplier</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>If disputed: platform dispute resolver reviews evidence</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 6 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-xl font-bold text-success-foreground">
                    6
                  </div>
                  <div>
                    <CardTitle className="mb-2">Final Delivery & Release</CardTitle>
                    <CardDescription className="text-base">
                      After confirmed delivery, the remaining escrow funds are released
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>Supplier uploads proof of delivery</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>PyME confirms receipt of goods</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>Final 50% released to supplier from escrow</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 7 */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    7
                  </div>
                  <div>
                    <CardTitle className="mb-2">PyME Repays Investor</CardTitle>
                    <CardDescription className="text-base">
                      After sales cycle completes, PyME repays the investor with yield
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Repayment tracked on platform (outside escrow in MVP)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Transaction hash recorded for transparency</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Deal marked as "Completed" on blockchain</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="mb-16 border-t border-border pt-16">
          <h2 className="mb-12 text-center text-3xl font-bold">Why MERCATO?</h2>
          
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Lock className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Non-Custodial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Funds go directly to smart contract on Stellar. No intermediary holds your money. 
                  Only the contract logic controls release conditions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                  <ShieldCheck className="h-6 w-6 text-success" />
                </div>
                <CardTitle>Transparent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Every transaction, milestone approval, and document hash is recorded on-chain. 
                  Anyone can verify the deal progress at any time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Fair to All</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  PyMEs get capital without debt, investors earn yield on real assets, 
                  suppliers get paid faster. Everyone wins.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-muted/50 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold">Ready to Get Started?</h2>
          <p className="mb-6 text-muted-foreground">
            Whether you're a PyME looking for financing, an investor seeking yield, 
            or a supplier wanting faster payments—MERCATO has you covered.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Browse Deals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/create-deal">Create Deal</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
