import { NextRequest, NextResponse } from 'next/server'
import { authorize, createExtraEdition } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Cria um post avulso a partir do link de uma matéria (painel). Body: { url }
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { url?: string }
  if (!body.url || !/^https?:\/\//i.test(body.url)) return NextResponse.json({ error: 'Informe a URL da matéria.' }, { status: 400 })
  try {
    const edition = await createExtraEdition({ url: body.url })
    return NextResponse.json({ ok: true, edition })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
