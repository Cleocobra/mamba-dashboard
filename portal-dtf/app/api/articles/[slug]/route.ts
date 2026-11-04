import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/pipeline'
import { deleteArticle, deleteImages, getArticle, saveArticle } from '@/lib/store'
import { cardCountFor } from '@/lib/render'
import { isValidSlug, readingMinutes } from '@/lib/utils'
import { CATEGORIES, MAX_CARDS, type Article } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { slug } = await params
  const article = await getArticle(slug)
  return article ? NextResponse.json({ article }) : NextResponse.json({ error: 'Tutorial não encontrado.' }, { status: 404 })
}

// Ajustes do painel: status e textos. Tutorial publicado continua editável (correções técnicas),
// mas o post do Instagram não muda.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { slug } = await params
  const a = await getArticle(slug)
  if (!a) return NextResponse.json({ error: 'Tutorial não encontrado.' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as Partial<Article>
  let cardsChanged = false

  if (body.status && ['approved', 'rejected', 'draft'].includes(body.status)) {
    if (a.status === 'published') return NextResponse.json({ error: 'Tutorial já publicado; o status não muda.' }, { status: 409 })
    a.status = body.status
  }
  if (typeof body.titulo === 'string' && body.titulo.trim()) { a.titulo = body.titulo.trim().slice(0, 90); cardsChanged = true }
  if (typeof body.resumo === 'string')     a.resumo = body.resumo.trim().slice(0, 170)
  if (typeof body.introducao === 'string') a.introducao = body.introducao.trim()
  if (typeof body.conclusao === 'string')  a.conclusao = body.conclusao.trim()
  if (typeof body.legenda === 'string')    a.legenda = body.legenda.trim().slice(0, 1800)
  if (Array.isArray(body.passos) && body.passos.length >= 1) {
    a.passos = body.passos.filter(p => p?.titulo && p?.texto).map(p => ({ titulo: String(p.titulo).trim(), texto: String(p.texto).trim() }))
    cardsChanged = true
  }
  if (Array.isArray(body.dicas)) a.dicas = body.dicas.map(String).map(s => s.trim()).filter(Boolean)
  if (Array.isArray(body.hashtags)) a.hashtags = body.hashtags.map(h => String(h).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 12)

  a.tempoMin = readingMinutes(a)
  if (cardsChanged) {
    await deleteImages(slug, MAX_CARDS)   // re-renderizados na próxima visualização
    a.cardCount = cardCountFor(a)
  }
  return NextResponse.json({ article: await saveArticle(a) })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { slug } = await params
  const a = await getArticle(slug)
  if (!a) return NextResponse.json({ error: 'Tutorial não encontrado.' }, { status: 404 })
  if (a.status === 'published') return NextResponse.json({ error: 'Tutorial publicado não é apagado pelo painel (perderia o link no Google).' }, { status: 409 })
  await deleteArticle(slug, MAX_CARDS)
  return NextResponse.json({ ok: true })
}

// Upsert completo (uso manual/desenvolvimento: semear um tutorial de teste ou importar um texto seu).
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })
  const b = await req.json().catch(() => null) as Partial<Article> | null
  if (!b || typeof b.titulo !== 'string' || !Array.isArray(b.passos) || b.passos.length === 0 || !b.categoria || !CATEGORIES.includes(b.categoria)) {
    return NextResponse.json({ error: 'Corpo inválido: titulo, categoria e passos são obrigatórios.' }, { status: 400 })
  }
  const prev = await getArticle(slug)
  if (prev?.status === 'published') return NextResponse.json({ error: 'Tutorial já publicado; use PATCH.' }, { status: 409 })
  const now = new Date().toISOString()
  const a: Article = {
    slug, status: b.status && b.status !== 'published' ? b.status : 'draft', createdAt: prev?.createdAt ?? now, updatedAt: now,
    titulo: b.titulo, resumo: b.resumo ?? '', categoria: b.categoria, nivel: b.nivel ?? 'iniciante', tempoMin: 0,
    introducao: b.introducao ?? '', materiais: b.materiais ?? [], passos: b.passos, dicas: b.dicas ?? [], problemas: b.problemas ?? [],
    faq: b.faq ?? [], conclusao: b.conclusao ?? '', palavrasChave: b.palavrasChave ?? [], legenda: b.legenda ?? '', hashtags: b.hashtags ?? [],
    cardCount: 0,
  }
  a.tempoMin = readingMinutes(a)
  a.cardCount = cardCountFor(a)
  await deleteImages(slug, MAX_CARDS)
  return NextResponse.json({ article: await saveArticle(a) })
}
