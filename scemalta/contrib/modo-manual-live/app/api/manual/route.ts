import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/pipeline'
import { enviarPacoteManual, manualMode, type PacoteManual } from '@/lib/manual'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET /api/manual → diz se o modo manual está ligado (login do painel ou Bearer CRON_SECRET).
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  return NextResponse.json({ manual: manualMode(), IG_MODE: process.env.IG_MODE || '(vazio = API)' })
}

// POST /api/manual { legenda, imagens?, video?, tipo?, titulo? } → manda um pacote de teste no WhatsApp.
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Partial<PacoteManual>
  const legenda = String(body.legenda || '').trim()
  if (!legenda) return NextResponse.json({ error: 'Informe a legenda.' }, { status: 400 })
  const imagens = Array.isArray(body.imagens) ? body.imagens.map(String).filter(u => /^https?:\/\//i.test(u)) : []
  try {
    const r = await enviarPacoteManual({ legenda, imagens, video: body.video ? String(body.video) : undefined, tipo: body.tipo, titulo: body.titulo })
    return NextResponse.json({ ok: true, ...r })
  } catch (err: any) {
    console.error('[manual]', err)
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
