// WhatsApp Business (Cloud API da Meta): receber links da equipe e responder com a prévia.
// Variáveis: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN,
//            WHATSAPP_APP_SECRET (assinatura dos webhooks), WHATSAPP_ALLOWED_NUMBERS (quem pode mandar).

import { createHmac, timingSafeEqual } from 'node:crypto'

const API_VER = 'v20.0'

function cfg() {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token   = process.env.WHATSAPP_TOKEN
  return phoneId && token ? { phoneId, token } : null
}
export const whatsappConfigured = () => cfg() !== null

// Só números listados podem acionar o sistema. Formato: dígitos com DDI, ex.: 5547999990000.
export function allowedNumber(from: string): boolean {
  const list = (process.env.WHATSAPP_ALLOWED_NUMBERS || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean)
  return list.includes(from.replace(/\D/g, ''))
}

// Valida X-Hub-Signature-256. Sem WHATSAPP_APP_SECRET, aceita (defina em produção).
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true
  if (!header || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const got = header.slice(7)
  return got.length === expected.length && timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'))
}

export interface IncomingText { id: string; from: string; name?: string; text: string }

// Extrai as mensagens de texto do payload do webhook (ignora status de entrega, mídia etc.).
export function parseIncoming(payload: any): IncomingText[] {
  const out: IncomingText[] = []
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value
      if (change?.field !== 'messages' || !value?.messages) continue
      const names: Record<string, string> = {}
      for (const c of value.contacts ?? []) if (c?.wa_id) names[c.wa_id] = c?.profile?.name
      for (const m of value.messages) {
        const text = m?.type === 'text' ? m.text?.body : m?.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : undefined
        if (typeof text === 'string' && m?.from) out.push({ id: m.id, from: m.from, name: names[m.from], text })
      }
    }
  }
  return out
}

async function send(body: Record<string, unknown>): Promise<void> {
  const c = cfg()
  if (!c) { console.warn('[whatsapp] não configurado; mensagem não enviada:', JSON.stringify(body).slice(0, 200)); return }
  const res = await fetch(`https://graph.facebook.com/${API_VER}/${c.phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...body }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(`WhatsApp API ${res.status}: ${err?.error?.message ?? 'erro desconhecido'}`)
  }
}

export const sendText  = (to: string, text: string) => send({ to, type: 'text', text: { body: text.slice(0, 4000), preview_url: true } })
export const sendImage = (to: string, link: string, caption: string) => send({ to, type: 'image', image: { link, caption: caption.slice(0, 1024) } })
