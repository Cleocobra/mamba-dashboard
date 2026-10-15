import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/pipeline'
import { addManualPauta } from '@/lib/pauta'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Pauta manual pelo painel: POST /api/pauta { url } (login do painel ou Bearer CRON_SECRET).
// Entra no plantão de hoje e manda o pedido de aprovação no WhatsApp; devolve o link de aprovação.
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { url?: string }
  const url = String(body.url || '').trim()
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'Informe o link da matéria (começando com http).' }, { status: 400 })
  try {
    const r = await addManualPauta(url, 'painel')
    return NextResponse.json({ ok: true, date: r.date, idx: r.entry.idx, titulo: r.entry.item.titulo, aprovar: r.aprovar })
  } catch (err: any) {
    console.error('[pauta]', err)
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
