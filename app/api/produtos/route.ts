import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { extrairProdutos, ProdutoItem } from '@/lib/lojaintegrada'
import { redisExec } from '@/lib/redis'

// Sem fallback: instância mal configurada deve falhar alto, nunca mostrar dados de outra loja
const LI_KEY_API  = process.env.LI_CHAVE_API       || ''
const LI_KEY_APP  = process.env.LI_CHAVE_APLICACAO || ''
const LI_BASE     = 'https://api.awsli.com.br/v1'

// ── Redis helpers (self-host via REDIS_URL ou Upstash REST) ────────────────
async function redisGet(key: string): Promise<string | null> {
  try { return await redisExec(['GET', key]) } catch { return null }
}

async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  try { await redisExec(['SET', key, value, 'EX', seconds]) } catch {}
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return null
  return verifyToken(token)
}

// ── LI fetch com retry (3 tentativas) ─────────────────────────────────────
async function liFetch(url: string, attempt = 1): Promise<any> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const text = await res.text()
    if (!res.ok) {
      if (attempt < 4) {
        // 429 (throttling LI) pede espera bem maior que erro transitório comum
        const espera = res.status === 429 ? 1500 * attempt : 300 * attempt
        await new Promise(r => setTimeout(r, espera))
        return liFetch(url, attempt + 1)
      }
      throw new Error(`Loja Integrada API ${res.status}: ${text}`)
    }
    return JSON.parse(text)
  } catch (e: any) {
    if (attempt < 4 && !e.message.startsWith('Loja Integrada')) {
      await new Promise(r => setTimeout(r, 300 * attempt))
      return liFetch(url, attempt + 1)
    }
    throw e
  }
}

// ── Busca pedidos do período paginando do mais recente pro mais antigo.
// order_by=-data_criacao + parada assim que a página cobre o início do período.
// Paginar tudo é inviável em loja grande (100k+ pedidos → throttling da LI).
async function getPedidosList(inicio: Date): Promise<any[]> {
  const desde = inicio.toISOString().slice(0, 10)
  const cacheKey = `pedidos_list_${desde}`
  const cached = await redisGet(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }

  const PAGE = 100
  const MAX_PAGES = 50   // teto de segurança (5.000 pedidos por consulta)
  const LOTE = 3         // páginas em paralelo — gentil com o rate limit
  const all: any[] = []
  let offset = 0
  let total = Infinity
  let coberto = false

  while (!coberto && offset < total && offset < MAX_PAGES * PAGE) {
    const lote: Promise<any>[] = []
    for (let i = 0; i < LOTE && offset < total && offset < MAX_PAGES * PAGE; i++) {
      lote.push(liFetch(
        `${LI_BASE}/pedido/?chave_api=${LI_KEY_API}&chave_aplicacao=${LI_KEY_APP}&limit=${PAGE}&offset=${offset}&order_by=-data_criacao`
      ))
      offset += PAGE
    }
    const results = await Promise.all(lote)
    for (const r of results) {
      all.push(...(r.objects || []))
      total = r.meta?.total_count ?? total
    }
    const maisAntigo = all[all.length - 1]?.data_criacao
    coberto = !!maisAntigo && new Date(maisAntigo).getTime() < inicio.getTime()
  }

  await redisSetEx(cacheKey, 300, JSON.stringify(all))
  return all
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
    const data = await liFetch(url)
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
    // pausa entre lotes — evita acumular throttling em períodos longos
    if (i + BATCH < numeros.length) await new Promise(r => setTimeout(r, 250))
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

  // Busca lista de pedidos do período (com cache Redis 5 min)
  let pedidosRaw: any[] = []
  try {
    pedidosRaw = await getPedidosList(inicio)
  } catch (e: any) {
    return NextResponse.json({ error: `Erro ao buscar pedidos: ${e.message}` }, { status: 500 })
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
      total_unidades:     produtos.reduce((s, p) => s + p.quantidade, 0),
      total_receita:      produtos.reduce((s, p) => s + p.receita, 0),
      pedidos_analisados: pedidosFiltrados.length,
      skus_unicos:        produtosMap.size,
      periodo,
      inicio:             inicio.toISOString(),
      fim:                fim.toISOString(),
    },
  })
}
