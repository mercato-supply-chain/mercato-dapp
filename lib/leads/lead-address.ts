import type { LeadRow } from '@/lib/admin/get-leads'

type LeadMetadata = {
  address?: unknown
  source_url?: unknown
}

function parseMetadata(metadata: LeadRow['metadata']): LeadMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  return metadata as LeadMetadata
}

/** Prefer structured metadata.address; fall back to free-text country from the form. */
export function getLeadDisplayAddress(lead: Pick<LeadRow, 'metadata' | 'country'>): string | null {
  const metadata = parseMetadata(lead.metadata)
  const metadataAddress = metadata?.address
  if (typeof metadataAddress === 'string' && metadataAddress.trim()) {
    return metadataAddress.trim()
  }

  const country = lead.country?.trim()
  return country || null
}
