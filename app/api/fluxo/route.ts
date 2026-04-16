import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const KEY_LANCAMENTOS   = 'mamba_fluxo_lancamentos'
const KEY_SALDO_INICIAL = 'mamba_fluxo_saldo_inicial'

// ── Redis helpers ──────────────────────────────────────────────────────────
async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: 'no-store',
    })
    const data = await res.json()
    return data.result ?? null
  } catch { return null }
}

async function redisSet(key: string, value: string): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, value]),
    })
  } catch {}
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

  const lancamentos   = rawLanc  ? JSON.parse(rawLanc) : []
  const saldoInicial  = rawSaldo ? parseFloat(rawSaldo) : 2000

  return NextResponse.json({ lancamentos, saldoInicial })
}

// ── PUT — salva estado completo ────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { lancamentos, saldoInicial } = await req.json()

  await Promise.all([
    redisSet(KEY_LANCAMENTOS,   JSON.stringify(lancamentos ?? [])),
    redisSet(KEY_SALDO_INICIAL, String(saldoInicial ?? 2000)),
  ])

  return NextResponse.json({ ok: true })
}
