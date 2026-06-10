import { redisExec } from './redis'

const BASE_URL = 'https://api.awsli.com.br/v1'
// Sem fallback: instância mal configurada deve falhar alto, nunca mostrar dados de outra loja
const CHAVE_API = process.env.LI_CHAVE_API || ''
const CHAVE_APLICACAO = process.env.LI_CHAVE_APLICACAO || ''

// Auth via query params (formato correto da Loja Integrada)
function authParams(): Record<string, string> {
  return {
    chave_api: CHAVE_API,
    chave_aplicacao: CHAVE_APLICACAO,
  }
}

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams()
  const auth = authParams()
  for (const [k, v] of Object.entries(auth)) query.set(k, v)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') query.set(k, String(v))
  }
  return `${BASE_URL}${path}?${query.toString()}`
}

export async function getPedidos(params: {
  data_inicio?: string
  data_fim?: string
  situacao_id?: number
  limit?: number
  offset?: number
  order_by?: string
} = {}) {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  }

  if (params.data_inicio) queryParams['criado_em__gte'] = params.data_inicio
  if (params.data_fim)    queryParams['criado_em__lte'] = params.data_fim
  if (params.situacao_id) queryParams['situacao'] = params.situacao_id
  if (params.order_by)    queryParams['order_by'] = params.order_by

  const url = buildUrl('/pedido/', queryParams)

  const res = await fetch(url, { next: { revalidate: 60 } })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Loja Integrada API ${res.status}: ${text}`)
  }

  return res.json()
}

// ── Data local YYYY-MM-DD (no fuso do servidor — TZ=America/Sao_Paulo) ──────
// NUNCA usar toISOString() pra agrupar por dia: ela converte pra UTC e
// desloca o dia a partir das 21h no Brasil.
export function localYMD(d: Date): string {
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

// ── Pedidos desde uma data (recente → antigo, parada antecipada) ────────────
// A LI ignora os filtros de data (criado_em__gte) e o param `sort`, mas honra
// `order_by=-data_criacao`: paginamos do mais novo e paramos quando a página
// alcança o início do período. Cache Redis curto compartilhado entre as rotas.
export async function getPedidosDesde(inicio: Date): Promise<any[]> {
  const cacheKey = `li_desde_${localYMD(inicio)}`
  try {
    const cached = await redisExec(['GET', cacheKey])
    if (cached) return JSON.parse(cached)
  } catch {}

  const PAGE = 100
  const MAX_PAGES = 50 // teto de segurança (~5.000 pedidos por consulta)
  const brutos: any[] = []
  let offset = 0
  let total = Infinity

  while (offset < total && offset < MAX_PAGES * PAGE) {
    const r = await getPedidos({ limit: PAGE, offset, order_by: '-data_criacao' })
    const objs = r.objects || []
    if (objs.length === 0) break
    total = r.meta?.total_count ?? total
    brutos.push(...objs)
    const maisAntigo = objs[objs.length - 1]?.data_criacao
    if (maisAntigo && new Date(maisAntigo).getTime() < inicio.getTime()) break
    offset += PAGE
  }

  const pedidos = normalizarPedidos(brutos)
  try { await redisExec(['SET', cacheKey, JSON.stringify(pedidos), 'EX', 180]) } catch {}
  return pedidos
}

// Normaliza o formato bruto da LI para o formato do dashboard
export function normalizarPedidos(objects: any[]) {
  return objects.map((p: any) => ({
    id: p.id,
    numero: String(p.numero || p.id),
    data: p.data_criacao || p.data_modificacao || '',
    cliente: extrairNomeCliente(p),
    status: p.situacao?.nome || p.situacao?.codigo || 'desconhecido',
    status_pagamento: p.situacao?.aprovado ? 'aprovado' : p.situacao?.cancelado ? 'cancelado' : 'pendente',
    valor_total: String(p.valor_total || '0'),
    produtos: [],
  }))
}

function extrairNomeCliente(pedido: any): string {
  // Tenta extrair o nome do cliente de diferentes campos possíveis
  if (pedido.cliente_nome) return pedido.cliente_nome
  if (pedido.nome_cliente) return pedido.nome_cliente
  if (typeof pedido.cliente === 'string') {
    // Ex: "/api/v1/cliente/89236394" → "Cliente #89236394"
    const id = pedido.cliente.split('/').filter(Boolean).pop()
    return id ? `Cliente #${id}` : '—'
  }
  if (pedido.cliente?.nome) return pedido.cliente.nome
  return '—'
}

export function calcularTotalPedidos(pedidos: any[]): number {
  return pedidos.reduce((acc: number, p: any) => {
    const valor = parseFloat(p.valor_total || '0')
    return acc + (isNaN(valor) ? 0 : valor)
  }, 0)
}

// ── Extração de produtos de um pedido detalhado ────────────────────────────
export interface ProdutoItem {
  nome:       string
  tipo:       string
  cor:        string
  tamanho:    string
  quantidade: number
  receita:    number
  sku:        string
}

function extrairTipo(variacao: Record<string, any>): string {
  for (const [key, val] of Object.entries(variacao)) {
    const k = key.toLowerCase()
    if (k.includes('gên') || k.includes('gen') || k.includes('tipo') || k.includes('model')) {
      return val?.nome || '—'
    }
  }
  return '—'
}

function extrairCor(variacao: Record<string, any>): string {
  for (const [, val] of Object.entries(variacao)) {
    if (val && typeof val === 'object' && 'cor' in val) return val.nome || '—'
  }
  for (const [key, val] of Object.entries(variacao)) {
    const k = key.toLowerCase()
    if (k.includes('cor') || k.includes('color') || k.includes('colour')) return val?.nome || '—'
  }
  return '—'
}

function extrairTamanho(variacao: Record<string, any>): string {
  for (const [key, val] of Object.entries(variacao)) {
    const k = key.toLowerCase()
    if (k.includes('tamanho') || k.includes('size') || k.includes('tam')) {
      return val?.nome || '—'
    }
  }
  return '—'
}

export function extrairProdutos(order: any): ProdutoItem[] {
  const itens: any[] = order.itens || []
  return itens.map(item => {
    const variacao: Record<string, any> = item.variacao || {}
    const qtd = parseFloat(item.quantidade || '0')
    const preco = parseFloat(item.preco_venda || item.preco_subtotal || '0')
    return {
      nome:       item.nome || '—',
      tipo:       extrairTipo(variacao),
      cor:        extrairCor(variacao),
      tamanho:    extrairTamanho(variacao),
      quantidade: qtd,
      receita:    qtd * preco,
      sku:        item.sku || '—',
    }
  })
}

export function agruparPedidosPorDia(pedidos: any[]): Record<string, { entradas: number; quantidade: number }> {
  const agrupado: Record<string, { entradas: number; quantidade: number }> = {}

  for (const p of pedidos) {
    const data = (p.data || p.data_criacao || '').split('T')[0]
    if (!data) continue
    if (!agrupado[data]) agrupado[data] = { entradas: 0, quantidade: 0 }
    const valor = parseFloat(p.valor_total || '0')
    agrupado[data].entradas += isNaN(valor) ? 0 : valor
    agrupado[data].quantidade += 1
  }

  return agrupado
}
