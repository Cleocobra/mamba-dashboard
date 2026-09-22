import { NextRequest, NextResponse } from 'next/server'
import { authorize, generateEdition, publishEdition, todaySP, isValidDate } from '@/lib/scemalta/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Gera a edição do dia (coleta + edição com Claude) e salva como rascunho.
// Cron: POST /api/scemalta/run  (Authorization: Bearer CRON_SECRET)
// Opções: ?date=YYYY-MM-DD  ?force=1 (regenera rascunho)  ?publish=1 (publica em seguida)
async function handle(req: NextRequest) {
  const caller = await authorize(req)
  if (!caller) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const q       = req.nextUrl.searchParams
  const date    = q.get('date') || todaySP()
  const force   = q.get('force') === '1'
  const publish = q.get('publish') === '1'
  if (!isValidDate(date)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })

  try {
    let edition = await generateEdition({ date, force })
    let skipped: string | undefined
    if (publish) ({ edition, skipped } = await publishEdition(date, { fromCron: caller === 'cron' }))
    return NextResponse.json({ ok: true, edition, skipped })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export const POST = handle
export const GET  = handle
