import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPedidos, extrairProdutos, ProdutoItem } from '@/lib/lojaintegrada'

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const LI_KEY_API  = process.env.LI_CHAVE_API        || 'c9b02688ef5097ab6a26'
const LI_KEY_APP  = process.env.LI_CHAVE_APLICACAO  || 'df63ca80-5968-4476-9b43-11189846cb9a'
const LI_BASE     = 'https://api.awsli.com.br/v1'

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

async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, value, 'EX', seconds]),
    })
  } catch {}
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Busca detalhes de um pedido (com cache Redis 30 min) ───────────────────
async function getOrderDetails(numero: number): Promise<any | null> {
  const cacheKey = `mamba_order_${numero}`
  const cached = await redisGet(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  try {
    const url = `${LI_BASE}/pedido/${numero}/?chave_api=${LI_KEY_API}&chave_aplicacao=${LI_KEY_APP}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data && !data.error_message) {
      await redisSetEx(cacheKey, 1800, JSON.stringify(data))
    }
    return data
  } catch { return null }
}

// ── Busca detalhes em lotes paralelos ─────────────────────────────────────
async function fetchDetailsBatched(numeros: number[]): Promise<any[]> {
  const BATCH = 15
  const results: any[] = []
  for (let i = 0; i < numeros.length; i += BATCH) {
    const batch = numeros.slice(i, i + BATCH)
    const res = await Promise.all(batch.map(n => getOrderDetails(n)))
    results.push(...res.filter(Boolean))
  }
  return results
}

// ── Período ────────────────────────────────────────────────────────────────
function calcularPeriodo(periodo: string, hoje: Date, dataInicio: string | null, dataFim: string | null) {
  if (periodo === 'personalizado' && dataInicio && dataFim) {
    return {
      inicio: new Date(dataInicio + 'T00:00:00'),
      fim:    new Date(dataFim   + 'T23:59:59'),
    }
  }
  const inicio = new Date(hoje)
  const fim    = new Date(hoje)
  fim.setHours(23, 59, 59, 999)
  switch (periodo) {
    case 'hoje':
      inicio.setHours(0, 0, 0, 0)
      break
    case 'semana':
      inicio.setDate(inicio.getDate() - 7)
      inicio.setHours(0, 0, 0, 0)
      break
    case 'mes':
      inicio.setDate(inicio.getDate() - 30)
      inicio.setHours(0, 0, 0, 0)
      break
    default:
      inicio.setHours(0, 0, 0, 0)
  }
  return { inicio, fim }
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await requireAuth(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periodo    = searchParams.get('periodo')     || 'semana'
  const dataInicio = searchParams.get('data_inicio')
  const dataFim    = searchParams.get('data_fim')

  const hoje = new Date()
  const { inicio, fim } = calcularPeriodo(periodo, hoje, dataInicio, dataFim)

  // Busca lista de pedidos (sem itens)
  let pedidosRaw: any[] = []
  try {
    const result = await getPedidos({ limit: 400 })
    pedidosRaw = result.objects || []
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // Filtra por período
  const pedidosFiltrados = pedidosRaw.filter((p: any) => {
    const d = new Date(p.data_criacao || p.data_modificacao).getTime()
    return d >= inicio.getTime() && d <= fim.getTime()
  })

  // Busca detalhes (com itens) em batch
  const numeros = pedidosFiltrados.map((p: any) => p.numero)
  const detalhes = await fetchDetailsBatched(numeros)

  // Agrega produtos por nome + tipo + cor + tamanho
  const produtosMap = new Map<string, ProdutoItem>()
  for (const order of detalhes) {
    // Ignora pedidos cancelados na contagem de produtos
    if (order.situacao?.cancelado) continue
    const itens = extrairProdutos(order)
    for (const item of itens) {
      const key = `${item.nome}||${item.tipo}||${item.cor}||${item.tamanho}`
      const existing = produtosMap.get(key)
      if (existing) {
        existing.quantidade += item.quantidade
        existing.receita    += item.receita
      } else {
        produtosMap.set(key, { ...item })
      }
    }
  }

  const produtos = Array.from(produtosMap.values())
    .sort((a, b) => b.quantidade - a.quantidade)

  return NextResponse.json({
    produtos,
    meta: {
      total_unidades:    produtos.reduce((s, p) => s + p.quantidade, 0),
      total_receita:     produtos.reduce((s, p) => s + p.receita, 0),
      pedidos_analisados: pedidosFiltrados.length,
      skus_unicos:       produtosMap.size,
      periodo,
      inicio:            inicio.toISOString(),
      fim:               fim.toISOString(),
    },
  })
}
