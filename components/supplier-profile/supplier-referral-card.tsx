'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

type Props = {
  companyId: string
}

export function SupplierReferralCard({ companyId }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [referredCount, setReferredCount] = useState<number | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (!companyId) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_supplier_id', companyId)
      .then(({ count }) => setReferredCount(count ?? 0))
  }, [companyId])

  const inviteLink = `${origin}/auth/sign-up?ref=${companyId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">{t('supplierReferral.title')}</p>
        {referredCount !== null && (
          <span className="ml-auto text-xs text-muted-foreground">
            {referredCount === 1
              ? t('supplierReferral.referredCount', { count: referredCount })
              : t('supplierReferral.referredCountPlural', { count: referredCount })}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('supplierReferral.description')}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
        <span className="flex-1 truncate text-xs text-muted-foreground">{inviteLink}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 gap-1.5 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" aria-hidden />{t('supplierReferral.copied')}</>
          ) : (
            <><Copy className="h-3.5 w-3.5" aria-hidden />{t('supplierReferral.copyLink')}</>
          )}
        </Button>
      </div>
    </div>
  )
}
