import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Navigation } from '@/components/navigation'
import { 
  ShieldCheck, 
  TrendingUp, 
  Boxes, 
  ArrowRight,
  Users,
  Lock,
  LineChart,
  Package // Import the Package component
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="secondary">
            Powered by Stellar Blockchain
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance md:text-6xl">
            {'Supply Chain Finance, '}
            <span className="text-accent">Transparently Secured</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground text-balance md:text-xl">
            MERCATO connects PyMEs, investors, and suppliers through blockchain-secured escrow. 
            Get funded, invest in real deals, and get paid on delivery—all transparently on-chain.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Explore Deals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/how-it-works">How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works - Three Columns */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight">Three Stakeholders, One Platform</h2>
            <p className="text-muted-foreground">Transparent financing for everyone involved</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Boxes className="h-6 w-6" />
                </div>
                <CardTitle>PyMEs (Buyers)</CardTitle>
                <CardDescription>
                  Get working capital to purchase inventory without debt on your balance sheet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>Create purchase orders for your suppliers</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>Investors fund the deal via escrow</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>Repay after your sales cycle completes</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-success text-success-foreground">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <CardTitle>Investors</CardTitle>
                <CardDescription>
                  Fund short-term deals (30-90 days) and earn attractive yields on USDC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span>Browse vetted supply chain deals</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span>Fund deals directly from your wallet</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span>Earn 8-15% APR on verified transactions</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle>Suppliers</CardTitle>
                <CardDescription>
                  Get paid upfront in milestones without waiting for buyer payment terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Receive 50% payment upfront</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Upload delivery proof on-chain</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Get final 50% after confirmed delivery</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight">Built on Trust & Transparency</h2>
            <p className="text-muted-foreground">
              Non-custodial escrow powered by Stellar and TrustlessWork
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Lock className="h-8 w-8 text-accent" />
              </div>
              <h3 className="mb-2 font-semibold">Non-Custodial Escrow</h3>
              <p className="text-sm text-muted-foreground">
                Funds go directly to smart contract. No one controls the money except the contract logic.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <ShieldCheck className="h-8 w-8 text-success" />
              </div>
              <h3 className="mb-2 font-semibold">Milestone-Based Release</h3>
              <p className="text-sm text-muted-foreground">
                Suppliers get paid in stages: 50% upfront, 50% after confirmed delivery.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <LineChart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Full On-Chain Proof</h3>
              <p className="text-sm text-muted-foreground">
                Every transaction, milestone, and delivery proof recorded transparently on Stellar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Ready to Get Started?</h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join MERCATO today and experience transparent, secure supply chain financing
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/marketplace">View Marketplace</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="font-semibold">MERCATO</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 MERCATO. Supply Chain Finance on Stellar.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
