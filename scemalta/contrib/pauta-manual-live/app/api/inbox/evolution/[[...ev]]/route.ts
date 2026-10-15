import { NextRequest, NextResponse, after } from 'next/server'
import { approvalNumbers, sendText } from '@/lib/whatsapp'
import { addManualPauta, firstUrl } from '@/lib/pauta'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Webhook da Evolution API (instância de alertas da Cobra), evento MESSAGES_UPSERT.
// Fora do login do painel (ver middleware): protegido por ?k=EVOLUTION_WEBHOOK_SECRET.
// Só números de APPROVAL_WHATSAPP são atendidos. Rota com [[...ev]] para aceitar também
// o modo "webhook por eventos" da Evolution (…/evolution/messages-upsert).
//
// Fluxo: você manda o link de uma matéria para o número de alertas → vira pauta manual no
// plantão de hoje → chega o card com o link de aprovação (como no radar) → aprova → publica.

function textOf(m: any): string {
  return m?.conversation ?? m?.extendedTextMessage?.text ?? m?.imageMessage?.caption ?? m?.videoMessage?.caption ?? ''
}

async function handle(m: { from: string; text: string; nome?: string }) {
  if (!approvalNumbers().includes(m.from)) { console.warn(`[inbox] número não autorizado: ${m.from}`); return }
  const url = firstUrl(m.text)
  if (!url) { await sendText(m.from, 'Me mande o link de uma matéria e eu preparo o post para a sua aprovação.').catch(() => {}); return }
  try {
    await sendText(m.from, 'Recebi. Lendo a matéria e preparando o card, um minuto…')
    await addManualPauta(url, `WhatsApp${m.nome ? ` · ${m.nome}` : ''}`)   // o pedido de aprovação (card + link) já é enviado
  } catch (err: any) {
    console.error('[inbox] pauta', err)
    await sendText(m.from, `Não consegui preparar o post: ${String(err?.message ?? err).slice(0, 400)}`).catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!secret || req.nextUrl.searchParams.get('k') !== secret) return new NextResponse('unauthorized', { status: 401 })
  const body = await req.json().catch(() => null)
  const events: any[] = Array.isArray(body) ? body : body ? [body] : []
  const msgs: { from: string; text: string; nome?: string }[] = []
  for (const ev of events) {
    const type = String(ev?.event ?? '').toLowerCase().replace(/_/g, '.')
    if (type !== 'messages.upsert') continue
    for (const d of Array.isArray(ev.data) ? ev.data : [ev.data]) {
      if (!d?.key || d.key.fromMe) continue
      const jid = String(d.key.remoteJid || '')
      if (!jid.endsWith('@s.whatsapp.net')) continue   // ignora grupos e newsletters
      const text = textOf(d.message).trim()
      if (!text) continue
      msgs.push({ from: jid.split('@')[0].replace(/\D/g, ''), text, nome: d.pushName })
    }
  }
  // Responde já (a Evolution reenvia se demorar) e processa depois.
  after(async () => { for (const m of msgs) await handle(m) })
  return NextResponse.json({ ok: true, received: msgs.length })
}

export async function GET() { return NextResponse.json({ ok: true }) }
