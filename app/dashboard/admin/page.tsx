import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, ArrowLeft, FileCheck } from 'lucide-react'
import { PendingApprovals } from './pending-approvals'
import { ReleaseFundsFallback } from './release-funds-fallback'
import { AdminEscrowsProvider } from './admin-escrows-provider'
import { AdminDefindexVaultPanel } from '@/components/admin/admin-defindex-vault-panel'

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

type AdminSearchParams = Promise<{ company?: string; sort?: string }> | { company?: string; sort?: string }

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: AdminSearchParams
}) {
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

  const configuredVaultAddress =
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
    process.env.MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
    ''

  const params = searchParams
    ? typeof (searchParams as Promise<{ company?: string; sort?: string }>).then === 'function'
      ? await (searchParams as Promise<{ company?: string; sort?: string }>)
      : (searchParams as { company?: string; sort?: string })
    : {}
  const companyFilter = params.company ?? null
  const sortOrder = (params.sort ?? 'newest') as 'newest' | 'oldest'

  let query = supabase
    .from('deals')
    .select(
      `id, title, product_name, amount, escrow_contract_address, created_at, pyme_id, supplier_id,
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      supplier:supplier_companies(company_name, full_name, contact_name)`
    )
    .not('escrow_contract_address', 'is', null)

  if (companyFilter) {
    if (companyFilter.startsWith('pyme:')) {
      const pymeId = companyFilter.slice(5)
      query = query.eq('pyme_id', pymeId)
    } else if (companyFilter.startsWith('supplier:')) {
      const supplierId = companyFilter.slice(9)
      query = query.eq('supplier_id', supplierId)
    }
  }

  const { data: dealsRows } = await query

  type DealRow = {
    id: string
    title?: string
    product_name?: string
    amount: number
    escrow_contract_address: string | null
    created_at?: string | null
    pyme_id?: string
    supplier_id?: string
    pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
    supplier?: { company_name?: string; full_name?: string; contact_name?: string } | null
  }

  const dealsList = (dealsRows ?? []) as DealRow[]
  const dealIds = dealsList.map((d) => d.id)
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

          <div className="mt-8 max-w-3xl">
            <AdminDefindexVaultPanel configuredVaultAddress={configuredVaultAddress} />
          </div>
        </div>
      </div>
    )
  }

  const { data: allMilestones } = await supabase
    .from('milestones')
    .select('id, deal_id, title, status, percentage, amount, proof_notes, proof_document_url, created_at, completed_at')
    .in('deal_id', dealIds)
    .order('created_at', { ascending: true })

  const dealsById = new Map(dealsList.map((d) => [d.id, d]))

  const sortByDealDate = (a: { dealId: string }, b: { dealId: string }) => {
    const dealA = dealsById.get(a.dealId) as DealRow | undefined
    const dealB = dealsById.get(b.dealId) as DealRow | undefined
    const dateA = dealA?.created_at ?? ''
    const dateB = dealB?.created_at ?? ''
    const cmp = dateA < dateB ? -1 : dateA > dateB ? 1 : 0
    return sortOrder === 'newest' ? -cmp : cmp
  }
  // Order milestones to match escrow contract (index 0 = Shipment, 1 = Delivery).
  // created_at is unreliable when milestones are inserted together. Use title DESC:
  // "Shipment Confirmation" > "Delivery Confirmation" → [Shipment, Delivery] = escrow order.
  const milestonesByDeal = new Map<string, { id: string; title: string }[]>()
  for (const m of allMilestones ?? []) {
    const list = milestonesByDeal.get(m.deal_id) ?? []
    list.push({ id: m.id, title: m.title ?? '' })
    milestonesByDeal.set(m.deal_id, list)
  }
  for (const list of milestonesByDeal.values()) {
    list.sort((a, b) => (a.title > b.title ? -1 : a.title < b.title ? 1 : 0))
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
  items.sort(sortByDealDate)

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
  releaseFallbackItems.sort(sortByDealDate)

  const uniquePymes = Array.from(
    new Map(
      dealsList
        .filter((d): d is DealRow & { pyme_id: string } => Boolean(d.pyme_id))
        .map((d) => [
          d.pyme_id,
          {
            id: d.pyme_id,
            name: d.pyme?.company_name || d.pyme?.full_name || d.pyme?.contact_name || 'PyME',
          },
        ])
    ).values()
  )
  const uniqueSuppliers = Array.from(
    new Map(
      dealsList
        .filter((d): d is DealRow & { supplier_id: string } => Boolean(d.supplier_id))
        .map((d) => [
          d.supplier_id,
          {
            id: d.supplier_id,
            name:
              d.supplier?.company_name ||
              d.supplier?.full_name ||
              d.supplier?.contact_name ||
              'Supplier',
          },
        ])
    ).values()
  )

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
          <span className="text-sm text-muted-foreground">Sort:</span>
          <div className="flex gap-2">
            <Button asChild variant={sortOrder === 'newest' ? 'default' : 'outline'} size="sm">
              <Link
                href={`/dashboard/admin${companyFilter ? `?company=${companyFilter}&sort=newest` : '?sort=newest'}`}
              >
                Newest first
              </Link>
            </Button>
            <Button asChild variant={sortOrder === 'oldest' ? 'default' : 'outline'} size="sm">
              <Link
                href={`/dashboard/admin${companyFilter ? `?company=${companyFilter}&sort=oldest` : '?sort=oldest'}`}
              >
                Oldest first
              </Link>
            </Button>
          </div>
          {(uniquePymes.length > 0 || uniqueSuppliers.length > 0) && (
            <>
              <span className="text-sm text-muted-foreground">Filter by company:</span>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant={!companyFilter ? 'default' : 'outline'} size="sm">
                  <Link
                    href={`/dashboard/admin${sortOrder !== 'newest' ? `?sort=${sortOrder}` : ''}`}
                  >
                    All
                  </Link>
                </Button>
                {uniquePymes.map((p) => (
                  <Button
                    key={`pyme-${p.id}`}
                    asChild
                    variant={companyFilter === `pyme:${p.id}` ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link
                      href={`/dashboard/admin?company=pyme:${p.id}${sortOrder !== 'newest' ? `&sort=${sortOrder}` : ''}`}
                    >
                      PyME: {p.name}
                    </Link>
                  </Button>
                ))}
                {uniqueSuppliers.map((s) => (
                  <Button
                    key={`supplier-${s.id}`}
                    asChild
                    variant={companyFilter === `supplier:${s.id}` ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link
                      href={`/dashboard/admin?company=supplier:${s.id}${sortOrder !== 'newest' ? `&sort=${sortOrder}` : ''}`}
                    >
                      Supplier: {s.name}
                    </Link>
                  </Button>
                ))}
              </div>
            </>
          )}
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

        <div className="mb-8 max-w-3xl">
          <AdminDefindexVaultPanel configuredVaultAddress={configuredVaultAddress} />
        </div>

        <AdminEscrowsProvider items={items} releaseFallbackItems={releaseFallbackItems} />
      </div>
    </div>
  )
}
