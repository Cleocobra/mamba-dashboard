import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/pipeline'
import { listEditions } from '@/lib/store'
import { instagramConfigured } from '@/lib/instagram'

export const dynamic = 'force-dynamic'

// Lista as edições (painel).
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 30), 100)
  const editions = await listEditions(limit)
  return NextResponse.json({
    editions,
    config: {
      instagram:   instagramConfigured(),
      anthropic:   Boolean(process.env.ANTHROPIC_API_KEY),
      brave:       Boolean(process.env.BRAVE_API_KEY),
      autoPublish: (process.env.SCEMALTA_AUTO_PUBLISH ?? 'true').toLowerCase() !== 'false',
    },
  })
}
