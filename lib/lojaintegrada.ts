const BASE_URL = 'https://api.awsli.com.br/v1'
const CHAVE_API = process.env.LI_CHAVE_API || 'c9b02688ef5097ab6a26'
const CHAVE_APLICACAO = process.env.LI_CHAVE_APLICACAO || 'df63ca80-5968-4476-9b43-11189846cb9a'

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
} = {}) {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 50,
    offset: params.offset || 0,
  }

  if (params.data_inicio) queryParams['criado_em__gte'] = params.data_inicio
  if (params.data_fim)    queryParams['criado_em__lte'] = params.data_fim
  if (params.situacao_id) queryParams['situacao'] = params.situacao_id

  const url = buildUrl('/pedido/', queryParams)

  const res = await fetch(url, { next: { revalidate: 60 } })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Loja Integrada API ${res.status}: ${text}`)
  }

  return res.json()
}

export async function getPedidosHoje() {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(hoje)
  fim.setHours(23, 59, 59, 999)

  // Busca ampla e filtra client-side (LI não filtra por data_criacao de forma confiável)
  const result = await getPedidos({ limit: 200 })
  const pedidos = normalizarPedidos(result.objects || [])

  const inicioMs = inicio.getTime()
  const fimMs = fim.getTime()

  return pedidos.filter((p: any) => {
    const d = new Date(p.data).getTime()
    return d >= inicioMs && d <= fimMs
  })
}

export async function getPedidosPeriodo(dias: number) {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - dias)
  inicio.setHours(0, 0, 0, 0)

  const result = await getPedidos({ limit: 500 })
  const pedidos = normalizarPedidos(result.objects || [])

  const inicioMs = inicio.getTime()
  return pedidos.filter((p: any) => new Date(p.data).getTime() >= inicioMs)
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
