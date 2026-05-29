import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://mercato.app'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Static routes
  const staticRoutes = [
    '',
    '/our-story',
    '/how-it-works',
    '/deals',
    '/suppliers',
    '/investors',
    '/marketplace',
    '/auth/sign-up',
    '/auth/login',
  ]

  const staticSitemaps = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL/Key missing for sitemap generation. Returning static routes only.')
    return staticSitemaps
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  let dealSitemaps: MetadataRoute.Sitemap = []
  try {
    const { data: deals } = await supabase
      .from('deals')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })

    if (deals) {
      dealSitemaps = deals.map((deal) => ({
        url: `${baseUrl}/deals/${deal.id}`,
        lastModified: deal.updated_at ? new Date(deal.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    console.error('Error fetching deals for sitemap:', error)
  }

  let supplierSitemaps: MetadataRoute.Sitemap = []
  try {
    const { data: suppliers } = await supabase
      .from('supplier_companies')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })

    if (suppliers) {
      supplierSitemaps = suppliers.map((supplier) => ({
        url: `${baseUrl}/suppliers/${supplier.id}`,
        lastModified: supplier.updated_at ? new Date(supplier.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    console.error('Error fetching suppliers for sitemap:', error)
  }

  return [...staticSitemaps, ...dealSitemaps, ...supplierSitemaps]
}
