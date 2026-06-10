import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { setChosenAccounts, clearChosenAccounts, getAllAccounts } from '@/lib/meta'

// Escolha das contas de anúncio que o painel acompanha (somente admin).
// POST {ids: [...]} grava a seleção; POST {reset: true} reabre o seletor.

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return null
  const user = await verifyToken(token)
  return user?.role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Apenas administradores podem alterar as contas.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as any))

  if (body.reset) {
    await clearChosenAccounts()
    return NextResponse.json({ ok: true, accounts_all: await getAllAccounts() })
  }

  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : []
  if (ids.length === 0)
    return NextResponse.json({ error: 'Selecione ao menos uma conta.' }, { status: 400 })

  const chosen = await setChosenAccounts(ids)
  if (chosen.length === 0)
    return NextResponse.json({ error: 'Contas inválidas — reconecte o Meta.' }, { status: 400 })

  return NextResponse.json({ ok: true, accounts: chosen })
}
