const DEFAULT_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://mercatocapital.xyz'

export function getAppOrigin() {
  return DEFAULT_ORIGIN
}

export function getEventUtmSource(slug: string) {
  return slug.replace(/-/g, '_')
}

export function getEventLandingUrl(
  slug: string,
  options?: {
    origin?: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  },
) {
  const origin = options?.origin ?? DEFAULT_ORIGIN
  const url = new URL(`/events/${slug}`, origin)

  url.searchParams.set('utm_source', options?.utmSource ?? getEventUtmSource(slug))
  url.searchParams.set('utm_medium', options?.utmMedium ?? 'qr')
  if (options?.utmCampaign) {
    url.searchParams.set('utm_campaign', options.utmCampaign)
  }

  return url.toString()
}
