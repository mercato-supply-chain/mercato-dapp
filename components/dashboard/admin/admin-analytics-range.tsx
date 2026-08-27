'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ANALYTICS_RANGE_KEYS } from '@/lib/admin/analytics-definitions'
import { useI18n } from '@/lib/i18n/provider'

/** URL-backed range picker: presets plus a custom UTC date range. */
export function AdminAnalyticsRange() {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentKey = searchParams.get('range') ?? '30d'

  function apply(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    update(params)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div
        role="group"
        aria-label={t('adminAnalytics.rangeLabel')}
        className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1"
      >
        {ANALYTICS_RANGE_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant={currentKey === key ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={currentKey === key}
            onClick={() =>
              apply((params) => {
                if (key === '30d') params.delete('range')
                else params.set('range', key)
                if (key !== 'custom') {
                  params.delete('from')
                  params.delete('to')
                }
              })
            }
          >
            {t(`adminAnalytics.ranges.${key}`)}
          </Button>
        ))}
      </div>

      {currentKey === 'custom' && (
        <>
          <div className="w-40">
            <Label htmlFor="analytics-from" className="mb-1.5 block text-xs">
              {t('adminAnalytics.customFrom')}
            </Label>
            <Input
              id="analytics-from"
              type="date"
              defaultValue={searchParams.get('from') ?? ''}
              onChange={(event) =>
                apply((params) => {
                  if (event.target.value) params.set('from', event.target.value)
                  else params.delete('from')
                })
              }
            />
          </div>
          <div className="w-40">
            <Label htmlFor="analytics-to" className="mb-1.5 block text-xs">
              {t('adminAnalytics.customTo')}
            </Label>
            <Input
              id="analytics-to"
              type="date"
              defaultValue={searchParams.get('to') ?? ''}
              onChange={(event) =>
                apply((params) => {
                  if (event.target.value) params.set('to', event.target.value)
                  else params.delete('to')
                })
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
