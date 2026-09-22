import { NextRequest, NextResponse } from 'next/server'
import { getEdition, getImage, saveImage } from '@/lib/scemalta/store'
import { cardCountFor, renderCard } from '@/lib/scemalta/render'
import { isValidDate } from '@/lib/scemalta/pipeline'

export const dynamic = 'force-dynamic'

// Público (sem login): serve o card N da edição em JPEG. É a URL que o Instagram baixa.
// GET /api/scemalta/img/2026-09-22/0.jpg
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string; file: string }> }) {
  const { date, file } = await params
  const m = /^(\d{1,2})\.jpe?g$/i.exec(file)
  if (!isValidDate(date) || !m) return new NextResponse('Not found', { status: 404 })
  const n = Number(m[1])

  let jpeg = await getImage(date, n)
  if (!jpeg) {
    const edition = await getEdition(date)
    if (!edition || edition.noticias.length === 0 || n >= cardCountFor(edition)) return new NextResponse('Not found', { status: 404 })
    jpeg = await renderCard(edition, n)
    await saveImage(date, n, jpeg)
  }
  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      'Content-Type':   'image/jpeg',
      'Content-Length': String(jpeg.length),
      'Cache-Control':  'public, max-age=300',
    },
  })
}
