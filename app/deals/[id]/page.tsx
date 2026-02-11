'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mockDeals } from '@/lib/mock-data'
import { formatDate } from '@/lib/date-utils'
import {
  Package,
  Building2,
  Calendar,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Upload
} from 'lucide-react'

export default function DealDetailPage() {
  const params = useParams()
  const deal = mockDeals.find(d => d.id === params.id)
  const [isFundingDialogOpen, setIsFundingDialogOpen] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isSupplierView, setIsSupplierView] = useState(false)

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">Deal Not Found</h1>
            <p className="mb-4 text-muted-foreground">The deal you're looking for doesn't exist.</p>
            <Button asChild>
              <Link href="/marketplace">Back to Marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = {
    awaiting_funding: { label: 'Open for Funding', color: 'text-accent', bgColor: 'bg-accent/10' },
    funded: { label: 'Funded', color: 'text-success', bgColor: 'bg-success/10' },
    in_progress: { label: 'In Progress', color: 'text-warning', bgColor: 'bg-warning/10' },
    milestone_pending: { label: 'Milestone Pending', color: 'text-warning', bgColor: 'bg-warning/10' },
    completed: { label: 'Completed', color: 'text-success', bgColor: 'bg-success/10' },
    disputed: { label: 'Disputed', color: 'text-destructive', bgColor: 'bg-destructive/10' },
    released: { label: 'Released', color: 'text-success', bgColor: 'bg-success/10' },
  }

  const status = statusConfig[deal.status]
  const completedMilestones = deal.milestones.filter(m => m.status === 'completed').length
  const progressPercentage = (completedMilestones / deal.milestones.length) * 100

  const handleFundDeal = () => {
    console.log('Funding deal with wallet:', walletAddress)
    alert(`Deal funded successfully! Transaction being processed on Stellar.`)
    setIsFundingDialogOpen(false)
  }

  const handleConnectWallet = () => {
    // In real app, integrate with Stellar Wallet Kit (Freighter/Lobstr/Albedo)
    alert('Opening wallet connection... (Freighter/Lobstr/Albedo)')
    setWalletAddress('GB7XMNE...')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/marketplace" className="hover:text-foreground">Marketplace</Link>
          <span>/</span>
          <span>Deal #{deal.id}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={`${status.color} ${status.bgColor}`}>
                  {status.label}
                </Badge>
                {deal.category && (
                  <Badge variant="outline">{deal.category}</Badge>
                )}
              </div>
              <h1 className="mb-2 text-4xl font-bold tracking-tight">{deal.productName}</h1>
              <p className="text-lg text-muted-foreground">
                {deal.description || `Supply chain financing deal for ${deal.pymeName}`}
              </p>
            </div>

            {deal.status === 'awaiting_funding' && (
              <Dialog open={isFundingDialogOpen} onOpenChange={setIsFundingDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2">
                    <Wallet className="h-5 w-5" />
                    Fund This Deal
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Fund Deal</DialogTitle>
                    <DialogDescription>
                      Connect your Stellar wallet to fund this deal with USDC
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Deal Amount</Label>
                      <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <p className="text-2xl font-bold">${deal.priceUSDC.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">USDC on Stellar</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Expected Return</Label>
                      <div className="rounded-lg border border-success bg-success/5 p-3">
                        <p className="text-2xl font-bold text-success">
                          {deal.yieldAPR}% APR
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${((deal.priceUSDC * (deal.yieldAPR || 0) / 100) * (deal.term / 365)).toFixed(2)} profit in {deal.term} days
                        </p>
                      </div>
                    </div>

                    {!walletAddress ? (
                      <Button onClick={handleConnectWallet} className="w-full">
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect Stellar Wallet
                      </Button>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Connected Wallet</Label>
                          <Input value={walletAddress} disabled />
                        </div>
                        <Button onClick={handleFundDeal} className="w-full">
                          Confirm & Fund Deal
                        </Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Deal Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-3xl font-bold">${deal.priceUSDC.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">USDC on Stellar</p>
                  </div>

                  {deal.yieldAPR && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Investor Yield</p>
                      <p className="text-3xl font-bold text-success">{deal.yieldAPR}%</p>
                      <p className="text-sm text-muted-foreground">APR ({deal.term} days)</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="text-2xl font-bold">{deal.quantity}</p>
                    <p className="text-sm text-muted-foreground">units</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Term</p>
                    <p className="text-2xl font-bold">{deal.term}</p>
                    <p className="text-sm text-muted-foreground">days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Milestones */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Milestones</CardTitle>
                <CardDescription>
                  Supplier payments released based on delivery confirmation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {completedMilestones} of {deal.milestones.length} completed
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>

                <div className="space-y-4">
                  {deal.milestones.map((milestone, index) => (
                    <div
                      key={milestone.id}
                      className={`rounded-lg border p-4 ${
                        milestone.status === 'completed'
                          ? 'border-success bg-success/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            milestone.status === 'completed'
                              ? 'bg-success text-success-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {milestone.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <h4 className="font-semibold">{milestone.name}</h4>
                            <Badge variant={milestone.status === 'completed' ? 'default' : 'secondary'}>
                              {milestone.percentage}%
                            </Badge>
                          </div>
                          <p className="mb-2 text-sm text-muted-foreground">
                            ${((deal.priceUSDC * milestone.percentage) / 100).toLocaleString()} USDC
                          </p>
                          {milestone.status === 'completed' && milestone.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              Completed on {formatDate(milestone.completedAt)}
                            </p>
                          )}

                          {/* Supplier Actions */}
                          {milestone.status === 'pending' && deal.status !== 'awaiting_funding' && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsSupplierView(!isSupplierView)}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Proof of {index === 0 ? 'Shipment' : 'Delivery'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabs: Details, On-Chain, Documents */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="onchain">On-Chain</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm font-medium">PyME (Buyer)</p>
                        <p className="text-sm text-muted-foreground">{deal.pymeName}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium">Supplier</p>
                        <p className="text-sm text-muted-foreground">{deal.supplier}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(deal.createdAt)}
                        </p>
                      </div>
                      {deal.fundedAt && (
                        <div>
                          <p className="mb-1 text-sm font-medium">Funded</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(deal.fundedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="onchain" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Blockchain Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {deal.escrowAddress ? (
                      <>
                        <div>
                          <p className="mb-1 text-sm font-medium">Escrow Contract</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 rounded bg-muted px-2 py-1 text-xs">
                              {deal.escrowAddress}
                            </code>
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={`https://stellar.expert/explorer/public/contract/${deal.escrowAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                        {deal.investorAddress && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Investor Address</p>
                            <code className="block rounded bg-muted px-2 py-1 text-xs">
                              {deal.investorAddress}
                            </code>
                          </div>
                        )}
                        {deal.supplierAddress && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Supplier Address</p>
                            <code className="block rounded bg-muted px-2 py-1 text-xs">
                              {deal.supplierAddress}
                            </code>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <span>Escrow contract will be deployed after funding</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Deal Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Documents will appear here after milestones
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stakeholders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stakeholders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Package className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">PyME (Buyer)</p>
                    <p className="text-sm text-muted-foreground">{deal.pymeName}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Investor</p>
                    <p className="text-sm text-muted-foreground">
                      {deal.investorAddress ? deal.investorAddress : 'Awaiting funding'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Supplier</p>
                    <p className="text-sm text-muted-foreground">{deal.supplier}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5" />
                  Security Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-muted-foreground">
                    Non-custodial escrow via TrustlessWork smart contract
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-muted-foreground">
                    Milestone-based payment release (50/50 split)
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-muted-foreground">
                    Full transparency on Stellar blockchain
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-muted-foreground">
                    Dispute resolution mechanism built-in
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Deal Created</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(deal.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {deal.fundedAt && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-xs font-medium text-success-foreground">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Funded</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(deal.fundedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {deal.completedAt && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-xs font-medium text-success-foreground">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Completed</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(deal.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
