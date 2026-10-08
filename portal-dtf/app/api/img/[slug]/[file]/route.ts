import { NextRequest, NextResponse } from 'next/server'
import { getArticle, getImage, saveImage } from '@/lib/store'
import { cardCountFor, renderCard } from '@/lib/render'
import { isValidSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Público (sem login): card N do tutorial em JPEG. É a URL que o Instagram baixa
// e a imagem de compartilhamento (Open Graph) do artigo.  GET /api/img/<slug>/0.jpg
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params
  const m = /^(\d{1,2})\.jpe?g$/i.exec(file)
  if (!isValidSlug(slug) || !m) return new NextResponse('Not found', { status: 404 })
  const n = Number(m[1])

  let jpeg = await getImage(slug, n)
  if (!jpeg) {
    const a = await getArticle(slug)
    if (!a || a.passos.length === 0 || n >= cardCountFor(a)) return new NextResponse('Not found', { status: 404 })
    jpeg = await renderCard(a, n)
    await saveImage(slug, n, jpeg)
  }
  return new NextResponse(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(jpeg.length), 'Cache-Control': 'public, max-age=300' },
  })
}
