import type { MetadataRoute } from 'next'
import { publicBaseUrl } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/api/img/'], disallow: ['/admin', '/api/'] }],
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  }
}
