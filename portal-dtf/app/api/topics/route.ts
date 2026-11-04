import { NextRequest, NextResponse } from 'next/server'
import { addTopics, authorize, refillTopics, type NewTopic } from '@/lib/pipeline'
import { listTopics, saveTopics } from '@/lib/store'
import { CATEGORIES, type Category } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const asCategory = (c: unknown): Category | undefined =>
  typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c) ? c as Category : undefined

// Fila de pautas.
//   GET                               → lista
//   POST { items: [{titulo, ...}] }   → adiciona (manual)
//   POST { suggest: 10 }              → pede sugestões ao Claude
//   PATCH { id, prioridade?, notas? } → ajusta
//   DELETE ?id=...                    → remove
export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  return NextResponse.json({ topics: await listTopics() })
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { items?: NewTopic[]; suggest?: number }
  try {
    if (body.suggest) {
      const added = await refillTopics(Math.max(1, Math.min(30, Number(body.suggest))))
      return NextResponse.json({ ok: true, added })
    }
    const items = (body.items ?? []).map(i => ({ ...i, categoria: asCategory(i.categoria) }))
    if (items.length === 0) return NextResponse.json({ error: 'Nenhuma pauta enviada.' }, { status: 400 })
    return NextResponse.json({ ok: true, added: await addTopics(items, 'manual') })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { id?: string; prioridade?: number; notas?: string; categoria?: string }
  const list = await listTopics()
  const t = list.find(x => x.id === body.id)
  if (!t) return NextResponse.json({ error: 'Pauta não encontrada.' }, { status: 404 })
  if (typeof body.prioridade === 'number') t.prioridade = Math.max(1, Math.min(10, Math.round(body.prioridade)))
  if (typeof body.notas === 'string') t.notas = body.notas.trim() || undefined
  if (body.categoria !== undefined) t.categoria = asCategory(body.categoria)
  await saveTopics(list)
  return NextResponse.json({ ok: true, topic: t })
}

export async function DELETE(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  const list = await listTopics()
  const next = list.filter(t => t.id !== id)
  if (next.length === list.length) return NextResponse.json({ error: 'Pauta não encontrada.' }, { status: 404 })
  await saveTopics(next)
  return NextResponse.json({ ok: true })
}
