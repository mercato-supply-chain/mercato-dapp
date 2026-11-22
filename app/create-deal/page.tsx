'use client'

import dynamic from 'next/dynamic'

const CreateDealContent = dynamic(() => import('./create-deal-content'), {
  ssr: false,
  loading: () => (
    <main id="main" tabIndex={-1} className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
    </main>
  ),
})

export default function CreateDealPage() {
  return <CreateDealContent />
}
