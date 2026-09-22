import { NextRequest, NextResponse } from 'next/server'
import { authorize, publishEdition, todaySP, isValidDate } from '@/lib/scemalta/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Publica a edição (renderiza os cards, libera no site e posta no Instagram).
// Cron: POST /api/scemalta/publish  (Authorization: Bearer CRON_SECRET) → publica a de hoje,
// a menos que tenha sido rejeitada no painel (ou, com SCEMALTA_AUTO_PUBLISH=false, não aprovada).
// Painel: POST /api/scemalta/publish?date=YYYY-MM-DD → publica sempre.
async function handle(req: NextRequest) {
  const caller = await authorize(req)
  if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const q    = req.nextUrl.searchParams
  const date = q.get('date') || todaySP()
  const skipInstagram = q.get('instagram') === '0'
  if (!isValidDate(date)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })

  try {
    const { edition, skipped } = await publishEdition(date, { fromCron: caller === 'cron', skipInstagram })
    return NextResponse.json({ ok: true, edition, skipped })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export const POST = handle
export const GET  = handle
