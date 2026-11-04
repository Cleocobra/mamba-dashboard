import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/pipeline'
import { listArticles } from '@/lib/store'
import { instagramConfigured } from '@/lib/instagram'
import { BRAND } from '@/lib/brand'

export const dynamic = 'force-dynamic'

// Lista os tutoriais (painel) + o que está configurado.
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  return NextResponse.json({
    articles: await listArticles(),
    config: {
      brand:       BRAND.name,
      instagram:   instagramConfigured(),
      anthropic:   Boolean(process.env.ANTHROPIC_API_KEY),
      autoPublish: (process.env.PORTAL_AUTO_PUBLISH ?? 'true').toLowerCase() !== 'false',
      perRun:      Number(process.env.PORTAL_ARTICLES_PER_RUN || 1),
    },
  })
}
