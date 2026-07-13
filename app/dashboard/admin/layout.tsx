import { getAdminQueueData } from '@/lib/admin/get-admin-queue-data'
import { getConfiguredVaultAddress, requireAdminProfile } from '@/lib/admin/require-admin'
import { AdminSubnav } from '@/components/dashboard/admin/admin-subnav'

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdminProfile()
  const queue = await getAdminQueueData(supabase)
  const vaultConfigured = Boolean(getConfiguredVaultAddress())

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
      <AdminSubnav
        pendingCount={queue.items.length + queue.createEscrowItems.length}
        releaseCount={queue.releaseFallbackItems.length}
        vaultConfigured={vaultConfigured}
      />
      {children}
    </div>
  )
}
