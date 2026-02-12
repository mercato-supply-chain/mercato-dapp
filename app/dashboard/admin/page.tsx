import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'
import { PendingApprovals } from './pending-approvals'

export interface PendingApprovalItem {
  dealId: string
  dealTitle: string
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  proofNotes: string | null
  proofDocumentUrl: string | null
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
    .select('id, title, escrow_contract_address')
    .not('escrow_contract_address', 'is', null)

  const dealIds = (dealsRows ?? []).map((d) => d.id)
  if (dealIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-6 text-3xl font-bold">Admin — Milestone approvals</h1>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" aria-hidden />
                Pending approvals
              </CardTitle>
              <CardDescription>
                No deals with escrow yet. When suppliers upload delivery proof, milestones will appear here for approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">There are no pending milestone approvals.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { data: milestones } = await supabase
    .from('milestones')
    .select('id, deal_id, title, status, proof_notes, proof_document_url, created_at')
    .in('deal_id', dealIds)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: true })

  const pendingWithProof = (milestones ?? []).filter(
    (m) => m.proof_notes != null || m.proof_document_url != null
  )

  const dealsById = new Map((dealsRows ?? []).map((d) => [d.id, d]))
  const milestonesByDeal = new Map<string, { id: string; created_at: string }[]>()
  for (const m of milestones ?? []) {
    const list = milestonesByDeal.get(m.deal_id) ?? []
    list.push({ id: m.id, created_at: m.created_at ?? '' })
    milestonesByDeal.set(m.deal_id, list)
  }
  for (const list of milestonesByDeal.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
  }

  const items: PendingApprovalItem[] = pendingWithProof.map((m) => {
    const deal = dealsById.get(m.deal_id)
    const ordered = milestonesByDeal.get(m.deal_id) ?? []
    const milestoneIndex = ordered.findIndex((x) => x.id === m.id)
    return {
      dealId: m.deal_id,
      dealTitle: deal?.title ?? 'Deal',
      escrowContractAddress: deal?.escrow_contract_address ?? '',
      milestoneId: m.id,
      milestoneTitle: m.title,
      milestoneIndex: milestoneIndex >= 0 ? milestoneIndex : 0,
      proofNotes: m.proof_notes ?? null,
      proofDocumentUrl: m.proof_document_url ?? null,
    }
  })

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Admin — Milestone approvals</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Pending approvals
            </CardTitle>
            <CardDescription>
              Suppliers have uploaded delivery proof for these milestones. Connect your admin wallet and approve to release the milestone on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingApprovals items={items} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
