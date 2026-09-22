import { NextRequest, NextResponse } from 'next/server'
import { authorize, isValidDate } from '@/lib/scemalta/pipeline'
import { deleteImages, getEdition, saveEdition } from '@/lib/scemalta/store'
import { cardCountFor } from '@/lib/scemalta/render'
import { MAX_CARDS, type Edition } from '@/lib/scemalta/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ date: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { date } = await params
  const edition = await getEdition(date)
  return edition ? NextResponse.json({ edition }) : NextResponse.json({ error: 'Edição não encontrada.' }, { status: 404 })
}

// Ajustes do painel: status (approved/rejected/draft) e edição de texto antes de publicar.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { date } = await params
  const edition = await getEdition(date)
  if (!edition) return NextResponse.json({ error: 'Edição não encontrada.' }, { status: 404 })
  if (edition.status === 'published') return NextResponse.json({ error: 'Edição já publicada; não pode ser alterada.' }, { status: 409 })

  const body = await req.json().catch(() => ({})) as Partial<Edition>
  let textChanged = false

  if (body.status && ['approved', 'rejected', 'draft'].includes(body.status)) edition.status = body.status
  if (typeof body.manchete === 'string') { edition.manchete = body.manchete.trim().slice(0, 80); textChanged = true }
  if (typeof body.legenda === 'string')  { edition.legenda  = body.legenda.trim().slice(0, 1800) }
  if (Array.isArray(body.hashtags))      { edition.hashtags = body.hashtags.map(h => String(h).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 12) }
  if (Array.isArray(body.noticias) && body.noticias.length >= 1) { edition.noticias = body.noticias.slice(0, 5); textChanged = true }
  if (Array.isArray(body.oportunidades)) { edition.oportunidades = body.oportunidades.slice(0, 4); textChanged = true }

  if (textChanged) {
    // Os cards serão renderizados de novo na próxima visualização/publicação.
    await deleteImages(date, MAX_CARDS)
    edition.cardCount = cardCountFor(edition)
  }
  return NextResponse.json({ edition: await saveEdition(edition) })
}

// Upsert completo (uso manual/desenvolvimento: semear uma edição de teste).
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const { date } = await params
  if (!isValidDate(date)) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
  const body = await req.json().catch(() => null) as Partial<Edition> | null
  if (!body || !Array.isArray(body.noticias) || typeof body.manchete !== 'string') {
    return NextResponse.json({ error: 'Corpo inválido: manchete e noticias são obrigatórios.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const edition: Edition = {
    date, status: body.status && body.status !== 'published' ? body.status : 'draft',
    createdAt: now, updatedAt: now,
    manchete: body.manchete, noticias: body.noticias.slice(0, 5), oportunidades: (body.oportunidades ?? []).slice(0, 4),
    legenda: body.legenda ?? '', hashtags: body.hashtags ?? [], rawCount: body.rawCount ?? 0, cardCount: 0,
  }
  edition.cardCount = cardCountFor(edition)
  await deleteImages(date, MAX_CARDS)
  return NextResponse.json({ edition: await saveEdition(edition) })
}
