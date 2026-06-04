import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { redisExec } from '@/lib/redis'

const KEY_LANCAMENTOS   = 'mamba_fluxo_lancamentos'
const KEY_SALDO_INICIAL = 'mamba_fluxo_saldo_inicial'

// ── Redis helpers ──────────────────────────────────────────────────────────
async function redisGet(key: string): Promise<string | null> {
  try {
    return await redisExec(['GET', key])
  } catch { return null }
}

async function redisSet(key: string, value: string): Promise<void> {
  // Lança em caso de falha — o PUT reporta o erro pro usuário.
  await redisExec(['SET', key, value])
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return null
  return verifyToken(token)
}

// ── GET — carrega dados ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await requireAuth(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [rawLanc, rawSaldo] = await Promise.all([
    redisGet(KEY_LANCAMENTOS),
    redisGet(KEY_SALDO_INICIAL),
  ])

  const lancamentos  = rawLanc  ? JSON.parse(rawLanc) : []
  const saldoInicial = rawSaldo ? parseFloat(rawSaldo) : 2000

  return NextResponse.json({ lancamentos, saldoInicial })
}

// ── PUT — salva estado completo ────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { lancamentos, saldoInicial } = await req.json()
    await Promise.all([
      redisSet(KEY_LANCAMENTOS,   JSON.stringify(lancamentos ?? [])),
      redisSet(KEY_SALDO_INICIAL, String(saldoInicial ?? 2000)),
    ])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[fluxo PUT] Erro ao salvar:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
