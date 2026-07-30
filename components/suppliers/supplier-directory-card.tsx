'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Briefcase, CheckCircle2, Globe, Mail, ArrowRight } from 'lucide-react'
import { getCountryLabel, getSectorLabel } from '@/lib/constants'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { useI18n } from '@/lib/i18n/provider'
import { SupplierLogo } from '@/components/suppliers/supplier-logo'
import type { Supplier } from '@/lib/suppliers/directory-utils'

type SupplierDirectoryCardProps = {
  supplier: Supplier
}

export function SupplierDirectoryCard({ supplier }: SupplierDirectoryCardProps) {
  const { t, messages } = useI18n()
  const countryLabel = (code: string) =>
    messages.geo.countries[code as keyof typeof messages.geo.countries] ?? getCountryLabel(code)
  const sectorLabel = (code: string) =>
    messages.geo.sectors[code as keyof typeof messages.geo.sectors] ?? getSectorLabel(code)
  const categoryLabel = (value: string) => getLocalizedCategoryLabel(value, messages)

  return (
    <Link
      href={`/suppliers/${supplier.id}`}
      className="group flex flex-col rounded-2xl border-2 border-border bg-card transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Card header */}
      <div className="flex-1 p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <SupplierLogo
            logoUrl={supplier.logo_url}
            companyName={supplier.company_name}
            size="md"
            className="group-hover:bg-primary/10"
          />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {supplier.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                {t('suppliersPage.verified')}
              </span>
            )}
            {supplier.categories?.[0] && (
              <Badge variant="outline" className="text-xs">
                {categoryLabel(supplier.categories[0])}
              </Badge>
            )}
          </div>
        </div>

        <h3 className="mb-1 text-base font-bold leading-snug transition-colors group-hover:text-primary">
          {supplier.company_name}
        </h3>

        {(supplier.sector || supplier.country) && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {supplier.sector && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                {sectorLabel(supplier.sector)}
              </span>
            )}
            {supplier.country && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3 shrink-0" aria-hidden />
                {countryLabel(supplier.country)}
              </span>
            )}
          </div>
        )}

        {supplier.bio && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{supplier.bio}</p>
        )}
      </div>

      {/* Products preview */}
      {supplier.products && supplier.products.length > 0 && (
        <div className="mx-5 mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('suppliersPage.products')}
          </p>
          <p className="mt-0.5 line-clamp-1 text-sm">{supplier.products.join(', ')}</p>
        </div>
      )}

      {/* Email */}
      {supplier.email && (
        <div className="mx-5 mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{supplier.email}</span>
        </div>
      )}

      {/* CTA */}
      <div className="p-5 pt-0">
        <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/50 py-2.5 text-sm font-semibold transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {t('suppliersPage.viewSupplier')}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </div>
      </div>
    </Link>
  )
}
