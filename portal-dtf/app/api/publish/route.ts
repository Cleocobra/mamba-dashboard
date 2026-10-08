import { NextRequest, NextResponse } from 'next/server'
import { authorize, publishArticle, publishPending } from '@/lib/pipeline'
import { isValidSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Publica tutoriais (renderiza os cards, libera no site e posta no Instagram).
// Cron:   POST /api/publish → todos os rascunhos não rejeitados (ou só os aprovados com PORTAL_AUTO_PUBLISH=false)
// Painel: POST /api/publish?slug=... → publica aquele tutorial agora.  ?instagram=0 → só no site.
async function handle(req: NextRequest) {
  const caller = await authorize(req)
  if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const q    = req.nextUrl.searchParams
  const slug = q.get('slug')
  const skipInstagram = q.get('instagram') === '0'

  try {
    if (!slug) return NextResponse.json({ ok: true, ...(await publishPending()) })
    if (!isValidSlug(slug)) return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })
    const { article, skipped } = await publishArticle(slug, { fromCron: caller === 'cron', skipInstagram })
    return NextResponse.json({ ok: true, article, skipped })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export const POST = handle
export const GET  = handle
