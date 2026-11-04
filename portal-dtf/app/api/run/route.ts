import { NextRequest, NextResponse } from 'next/server'
import { authorize, generateArticle, publishArticle, runDaily } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Gera tutorial(is) a partir da fila de pautas e salva como rascunho.
// Cron:  POST /api/run  (Authorization: Bearer CRON_SECRET) → PORTAL_ARTICLES_PER_RUN tutoriais
// Painel: POST /api/run → 1 tutorial da próxima pauta;  ?topic=ID → daquela pauta;  ?publish=1 → publica em seguida
async function handle(req: NextRequest) {
  const caller = await authorize(req)
  if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const q       = req.nextUrl.searchParams
  const topicId = q.get('topic') || undefined
  const publish = q.get('publish') === '1'

  try {
    if (caller === 'cron' && !topicId) {
      const { created, errors } = await runDaily()
      if (created.length === 0) return NextResponse.json({ ok: false, error: errors.join(' | ') || 'Nada gerado.' }, { status: 500 })
      return NextResponse.json({ ok: true, created: created.map(a => a.slug), errors })
    }
    let article = await generateArticle({ topicId })
    let skipped: string | undefined
    if (publish) ({ article, skipped } = await publishArticle(article.slug, { fromCron: caller === 'cron' }))
    return NextResponse.json({ ok: true, article, skipped })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export const POST = handle
export const GET  = handle
