import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { authorize } from '@/lib/pipeline'
import { addLead, hitRateLimit, listLeads } from '@/lib/store'
import { INTERESTS, type Interest } from '@/lib/types'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// POST público: formulário "quero conhecer" da página /solucoes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (str(body.site, 200)) return NextResponse.json({ ok: true })   // honeypot: robôs preenchem, pessoas não veem

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'anon'
  if (await hitRateLimit(ip, 5, 3600)) return NextResponse.json({ error: 'Muitos envios. Tente de novo mais tarde.' }, { status: 429 })

  const nome = str(body.nome, 80)
  const contato = str(body.contato, 120)
  const interesse = (INTERESTS as readonly string[]).includes(String(body.interesse)) ? body.interesse as Interest : 'outro'
  if (nome.length < 2 || contato.length < 6) return NextResponse.json({ error: 'Informe nome e WhatsApp ou e-mail.' }, { status: 400 })

  await addLead({
    id: randomUUID(), nome, contato, interesse,
    empresa: str(body.empresa, 120) || undefined, mensagem: str(body.mensagem, 1000) || undefined,
    createdAt: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true })
}

// GET (painel): lista os interessados.
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  return NextResponse.json({ leads: await listLeads() })
}
