'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApproveMilestone, useSendTransaction } from '@trustless-work/escrow/hooks'
import type { ApproveMilestonePayload } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, CheckCircle2, ExternalLink } from 'lucide-react'
import type { PendingApprovalItem } from './page'

interface PendingApprovalsProps {
  items: PendingApprovalItem[]
}

export function PendingApprovals({ items }: PendingApprovalsProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const { approveMilestone } = useApproveMilestone()
  const { sendTransaction } = useSendTransaction()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const supabase = createClient()

  const handleApprove = async (item: PendingApprovalItem) => {
    if (!walletInfo?.address) {
      toast.error('Connect your Stellar wallet to approve.')
      return
    }
    if (!item.escrowContractAddress) {
      toast.error('Deal has no escrow contract.')
      return
    }
    setApprovingId(item.milestoneId)
    try {
      const payload: ApproveMilestonePayload = {
        contractId: item.escrowContractAddress,
        milestoneIndex: String(item.milestoneIndex),
        approver: walletInfo.address,
        ...(item.proofNotes || item.proofDocumentUrl
          ? { newEvidence: [item.proofNotes, item.proofDocumentUrl].filter(Boolean).join(' | ') }
          : {}),
      }
      const response = await approveMilestone(payload, 'multi-release')
      if (response.status !== 'SUCCESS' || !response.unsignedTransaction) {
        throw new Error('Failed to create approval transaction')
      }
      const signedXdr = await signTransaction({
        unsignedTransaction: response.unsignedTransaction,
        address: walletInfo.address,
      })
      if (!signedXdr) throw new Error('Failed to sign transaction')
      const txResult = await sendTransaction(signedXdr)
      if (txResult.status !== 'SUCCESS') {
        throw new Error(
          'message' in txResult ? (txResult as { message: string }).message : 'Transaction failed'
        )
      }
      const { error } = await supabase
        .from('milestones')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.milestoneId)
      if (error) throw error
      toast.success(`Milestone "${item.milestoneTitle}" approved.`)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed'
      console.error('Approve milestone error:', err)
      toast.error(message)
    } finally {
      setApprovingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">There are no pending milestone approvals.</p>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.milestoneId}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/deals/${item.dealId}`}
                className="font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                {item.dealTitle}
              </Link>
              <Badge variant="secondary">{item.milestoneTitle}</Badge>
            </div>
            {(item.proofNotes || item.proofDocumentUrl) && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {item.proofNotes}
                {item.proofDocumentUrl && (
                  <a
                    href={item.proofDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-accent hover:underline"
                  >
                    Link <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isConnected ? (
              <Button type="button" onClick={handleConnect} size="sm">
                <Wallet className="mr-2 h-4 w-4" aria-hidden />
                Connect wallet
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => handleApprove(item)}
                disabled={approvingId === item.milestoneId}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                {approvingId === item.milestoneId ? 'Approving…' : 'Approve'}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
