import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, ArrowLeft, FileCheck } from 'lucide-react'
import { PendingApprovals } from './pending-approvals'
import { ReleaseFundsFallback } from './release-funds-fallback'

/** Milestone awaiting approval + release (in_progress) */
export interface PendingApprovalItem {
  dealId: string
  dealTitle: string
  dealProductName: string | null
  dealAmount: number
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  milestonePercentage: number
  milestoneAmount: number
  proofNotes: string | null
  proofDocumentUrl: string | null
  pymeName: string
  supplierName: string
}

/** Completed milestone: admin can trigger release only (fallback if approve ran but release didn’t) */
export interface ReleaseFallbackItem {
  dealId: string
  dealTitle: string
  dealProductName: string | null
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  milestoneAmount: number
  milestonePercentage: number
  completedAt: string | null
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') {
    redirect('/dashboard')
  }

  const { data: dealsRows } = await supabase
    .from('deals')
    .select(
      `id, title, product_name, amount, escrow_contract_address,
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      supplier:profiles!deals_supplier_id_fkey(company_name, full_name, contact_name)`
    )
    .not('escrow_contract_address', 'is', null)

  type DealRow = {
    id: string
    title?: string
    product_name?: string
    amount: number
    escrow_contract_address: string | null
    pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
    supplier?: { company_name?: string; full_name?: string; contact_name?: string } | null
  }

  const dealIds = (dealsRows ?? []).map((d: { id: string }) => d.id)
  if (dealIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="mb-2 text-3xl font-bold">Milestone approvals</h1>
          <p className="mb-6 text-muted-foreground">Approve milestones to release funds from escrow on-chain.</p>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" aria-hidden />
                Pending approvals
              </CardTitle>
              <CardDescription>
                No deals with escrow yet. When suppliers accept orders or upload delivery proof, milestones will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">There are no pending milestone approvals.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data: allMilestones } = await supabase
    .from('milestones')
    .select('id, deal_id, title, status, percentage, amount, proof_notes, proof_document_url, created_at, completed_at')
    .in('deal_id', dealIds)
    .order('created_at', { ascending: true })

  const dealsById = new Map((dealsRows ?? []).map((d: DealRow) => [d.id, d]))
  const milestonesByDeal = new Map<string, { id: string; created_at: string }[]>()
  for (const m of allMilestones ?? []) {
    const list = milestonesByDeal.get(m.deal_id) ?? []
    list.push({ id: m.id, created_at: m.created_at ?? '' })
    milestonesByDeal.set(m.deal_id, list)
  }
  for (const list of milestonesByDeal.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  }

  const inProgressMilestones = (allMilestones ?? []).filter((m) => m.status === 'in_progress')
  const completedMilestones = (allMilestones ?? []).filter((m) => m.status === 'completed')

  const items: PendingApprovalItem[] = inProgressMilestones.map((m) => {
    const deal = dealsById.get(m.deal_id) as DealRow | undefined
    const ordered = milestonesByDeal.get(m.deal_id) ?? []
    const milestoneIndex = ordered.findIndex((x) => x.id === m.id)
    const pymeName =
      deal?.pyme?.company_name || deal?.pyme?.full_name || deal?.pyme?.contact_name || '—'
    const supplierName =
      deal?.supplier?.company_name || deal?.supplier?.full_name || deal?.supplier?.contact_name || '—'
    return {
      dealId: m.deal_id,
      dealTitle: deal?.title ?? 'Deal',
      dealProductName: deal?.product_name ?? null,
      dealAmount: Number(deal?.amount ?? 0),
      escrowContractAddress: deal?.escrow_contract_address ?? '',
      milestoneId: m.id,
      milestoneTitle: m.title,
      milestoneIndex: milestoneIndex >= 0 ? milestoneIndex : 0,
      milestonePercentage: Number(m.percentage ?? 0),
      milestoneAmount: Number(m.amount ?? 0),
      proofNotes: m.proof_notes ?? null,
      proofDocumentUrl: m.proof_document_url ?? null,
      pymeName,
      supplierName,
    }
  })

  const releaseFallbackItems: ReleaseFallbackItem[] = completedMilestones.map((m) => {
    const deal = dealsById.get(m.deal_id) as DealRow | undefined
    const ordered = milestonesByDeal.get(m.deal_id) ?? []
    const milestoneIndex = ordered.findIndex((x) => x.id === m.id)
    return {
      dealId: m.deal_id,
      dealTitle: deal?.title ?? 'Deal',
      dealProductName: deal?.product_name ?? null,
      escrowContractAddress: deal?.escrow_contract_address ?? '',
      milestoneId: m.id,
      milestoneTitle: m.title,
      milestoneIndex: milestoneIndex >= 0 ? milestoneIndex : 0,
      milestoneAmount: Number(m.amount ?? 0),
      milestonePercentage: Number(m.percentage ?? 0),
      completedAt: m.completed_at ?? null,
    }
  })

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Dashboard
              </Link>
            </Button>
            <h1 className="mt-2 text-3xl font-bold">Milestone approvals</h1>
            <p className="mt-1 text-muted-foreground">
              Approve milestones to release funds from escrow. Connect your admin wallet to sign on-chain.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <FileCheck className="h-8 w-8 text-primary" aria-hidden />
              <div>
                <p className="text-2xl font-bold tabular-nums">{items.length}</p>
                <p className="text-sm text-muted-foreground">
                  milestone{items.length !== 1 ? 's' : ''} awaiting release
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Pending approvals
            </CardTitle>
            <CardDescription>
              First 50%: supplier accepted order. Remaining: delivery proof uploaded. Approve each to release funds to the supplier on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingApprovals items={items} />
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" aria-hidden />
              Release funds (fallback)
            </CardTitle>
            <CardDescription>
              Milestones already marked completed (e.g. approved earlier). If funds were not released (e.g. before we added the release step), trigger release here. Safe to click even if already released — the contract will reject a duplicate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReleaseFundsFallback items={releaseFallbackItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
