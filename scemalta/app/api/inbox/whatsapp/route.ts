import { NextRequest, NextResponse, after } from 'next/server'
import { allowedNumber, parseIncoming, sendImage, sendText, verifySignature } from '@/lib/whatsapp'
import { firstUrl } from '@/lib/article'
import { createExtraEdition, publishEdition, imageUrl, publicBaseUrl } from '@/lib/pipeline'
import { getEdition, saveEdition, getPending, setPending } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Webhook do WhatsApp (Meta Cloud API). Público; a Meta valida pelo verify token (GET)
// e assina cada entrega (POST, X-Hub-Signature-256). Só números autorizados são atendidos.

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

const PUBLISH = /^(publicar|publica|postar|sim|ok|aprovar|aprovado)\b/i
const CANCEL  = /^(cancelar|cancela|n[aã]o|rejeitar|descartar)\b/i

async function handle(msg: { from: string; text: string; name?: string }) {
  const { from, text } = msg
  if (!allowedNumber(from)) { console.warn(`[whatsapp] número não autorizado: ${from}`); return }
  const t = text.trim()

  try {
    if (PUBLISH.test(t)) {
      const id = await getPending(from)
      if (!id) return sendText(from, 'Não tenho nenhuma notícia pendente sua. Me mande o link de uma matéria.')
      const { edition, skipped } = await publishEdition(id)
      await setPending(from, null)
      const site = `${publicBaseUrl()}/${edition.id}`
      return sendText(from, skipped ? `Essa já estava publicada: ${site}` : `Publicado!\nSite: ${site}${edition.instagram?.permalink ? `\nInstagram: ${edition.instagram.permalink}` : '\nInstagram: não configurado ainda, foi só para o site.'}`)
    }
    if (CANCEL.test(t)) {
      const id = await getPending(from)
      if (id) {
        const e = await getEdition(id)
        if (e && e.status !== 'published') { e.status = 'rejected'; await saveEdition(e) }
        await setPending(from, null)
      }
      return sendText(from, 'Cancelado. Quando quiser, me mande outro link.')
    }
    const url = firstUrl(t)
    if (!url) return sendText(from, 'Me mande o link de uma matéria e eu preparo o post. Depois responda PUBLICAR ou CANCELAR.')

    await sendText(from, 'Recebi. Lendo a matéria e preparando o card, um minuto…')
    const e = await createExtraEdition({ url, from, nome: msg.name })
    await setPending(from, e.id)
    const caption = `${e.manchete}\n\n${e.noticias[0].titulo}\n${e.noticias[0].resumo}\n\nFonte: ${e.noticias[0].fonte}\n\nResponda PUBLICAR para postar no site e no Instagram, ou CANCELAR.`
    await sendImage(from, `${imageUrl(e.id, 1)}?v=${encodeURIComponent(e.updatedAt)}`, caption)
  } catch (err: any) {
    console.error('[whatsapp] erro:', err)
    await sendText(from, `Não consegui preparar o post: ${String(err?.message ?? err).slice(0, 300)}`).catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) return new NextResponse('Bad signature', { status: 401 })
  let payload: any
  try { payload = JSON.parse(raw) } catch { return new NextResponse('Bad JSON', { status: 400 }) }
  const messages = parseIncoming(payload)
  // Responde 200 na hora (a Meta exige) e processa depois.
  after(async () => { for (const m of messages) await handle(m) })
  return NextResponse.json({ ok: true, received: messages.length })
}
