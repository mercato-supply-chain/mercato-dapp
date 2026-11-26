import { getStellarNetworkPulse } from '@/lib/stellar/network-pulse'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { toIntlLocale } from '@/lib/i18n/format'
import { getServerLocale, tr } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

function formatLedger(ledger: number, locale: string) {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(ledger)
}

export async function LandingNetworkPulse({ className }: { className?: string }) {
  const localePromise = getServerLocale()
  const pulsePromise = getStellarNetworkPulse()
  const locale = await localePromise
  const [pulse, messages] = await Promise.all([pulsePromise, getDictionary(locale)])
  const networkLabel = tr(messages, `landing.network.${pulse.network}`)
  const status = pulse.healthy
    ? tr(messages, 'landing.network.healthy', { network: networkLabel })
    : tr(messages, 'landing.network.degraded', { network: networkLabel })

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', className)}>
      <span className="inline-flex items-center gap-2 text-foreground">
        <span
          className={
            pulse.healthy
              ? 'h-1.5 w-1.5 rounded-full bg-brand-light motion-safe:animate-pulse'
              : 'h-1.5 w-1.5 rounded-full bg-warning'
          }
          aria-hidden
        />
        <span className="font-medium">{status}</span>
      </span>
      {pulse.ledger != null ? (
        <span className="tabular-nums text-muted-foreground">
          {tr(messages, 'landing.network.ledger', {
            ledger: formatLedger(pulse.ledger, locale),
          })}
        </span>
      ) : null}
      <a
        href={pulse.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {tr(messages, 'landing.network.explorer')}
      </a>
    </div>
  )
}
