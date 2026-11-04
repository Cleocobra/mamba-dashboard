import type { MetadataRoute } from 'next'
import { listPublished } from '@/lib/store'
import { publicBaseUrl } from '@/lib/brand'
import { CATEGORIES } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicBaseUrl()
  const articles = await listPublished()
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/tutoriais`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/ferramentas/custo-dtf`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/solucoes`, changeFrequency: 'monthly', priority: 0.7 },
    ...CATEGORIES.map(c => ({ url: `${base}/categoria/${c}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...articles.map(a => ({ url: `${base}/tutoriais/${a.slug}`, lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ]
}
