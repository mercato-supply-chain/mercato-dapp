'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n/provider'
import type { EventConfig } from '@/lib/events/config'
import { getEventLandingUrl } from '@/lib/events/event-url'
import { Copy, Download, QrCode } from 'lucide-react'
import { toast } from 'sonner'

type AdminEventQrCardProps = {
  event: EventConfig
}

export function AdminEventQrCard({ event }: AdminEventQrCardProps) {
  const { t } = useI18n()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)

  const landingUrl =
    typeof window !== 'undefined'
      ? getEventLandingUrl(event.slug, { origin: window.location.origin })
      : getEventLandingUrl(event.slug)

  useEffect(() => {
    let cancelled = false
    setIsGenerating(true)

    QRCode.toDataURL(landingUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false)
      })

    return () => {
      cancelled = true
    }
  }, [landingUrl])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(landingUrl)
      toast.success(t('adminLeads.qr.copied'))
    } catch {
      toast.error(t('adminLeads.qr.copyError'))
    }
  }

  const downloadQr = () => {
    if (!qrDataUrl) return

    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `mercato-${event.slug}-qr.png`
    link.click()
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{event.slug}</p>
          <p className="text-xs text-muted-foreground">{t(event.titleKey)}</p>
        </div>
        <QrCode className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      <div className="mb-4 flex justify-center rounded-lg border border-border/60 bg-white p-4">
        {isGenerating ? (
          <div className="flex h-48 w-48 items-center justify-center text-sm text-muted-foreground">
            {t('adminLeads.qr.generating')}
          </div>
        ) : qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={t('adminLeads.qr.previewAlt', { event: event.slug })}
            className="h-48 w-48"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center text-sm text-destructive">
            {t('adminLeads.qr.generateError')}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('adminLeads.qr.urlLabel')}
          </p>
          <Input readOnly value={landingUrl} className="font-mono text-xs" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="mr-2 h-4 w-4" aria-hidden />
            {t('adminLeads.qr.copyUrl')}
          </Button>
          <Button type="button" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {t('adminLeads.qr.downloadPng')}
          </Button>
        </div>
      </div>
    </div>
  )
}
