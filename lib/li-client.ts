// Chamadas à Loja Integrada feitas client-side (navegador)
// A LI suporta CORS (access-control-allow-origin: *) — funciona no browser

const BASE = 'https://api.awsli.com.br/v1'
const CHAVE_API = 'c9b02688ef5097ab6a26'
const CHAVE_APLICACAO = 'df63ca80-5968-4476-9b43-11189846cb9a'

function url(path: string, params: Record<string, string | number> = {}): string {
  const q = new URLSearchParams({ chave_api: CHAVE_API, chave_aplicacao: CHAVE_APLICACAO })
  for (const [k, v] of Object.entries(params)) q.set(k, String(v))
  return `${BASE}${path}?${q}`
}

export interface PedidoNorm {
  id: number
  numero: string
  data: string
  cliente: string
  status: string
  status_pagamento: string
  valor_total: string
}

function normalizar(p: any): PedidoNorm {
  return {
    id: p.id,
    numero: String(p.numero || p.id),
    data: p.data_criacao || '',
    cliente: extrairCliente(p),
    status: p.situacao?.nome || p.situacao?.codigo || '—',
    status_pagamento: p.situacao?.aprovado ? 'Aprovado' : p.situacao?.cancelado ? 'Cancelado' : 'Pendente',
    valor_total: String(p.valor_total || '0'),
  }
}

function extrairCliente(p: any): string {
  if (p.cliente_nome) return p.cliente_nome
  if (typeof p.cliente === 'string') {
    const id = p.cliente.split('/').filter(Boolean).pop()
    return id ? `#${id}` : '—'
  }
  return '—'
}

// Busca todos os pedidos (LI retorna em ordem decrescente de ID)
async function fetchPedidos(limit = 200, offset = 0): Promise<{ objects: any[]; total: number }> {
  const res = await fetch(url('/pedido/', { limit, offset }))
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return { objects: data.objects || [], total: data.meta?.total_count || 0 }
}

// Filtra por período client-side
function filtrarPorPeriodo(pedidos: PedidoNorm[], periodo: string): PedidoNorm[] {
  const agora = new Date()
  const hoje0 = new Date(agora); hoje0.setHours(0, 0, 0, 0)
  const hoje24 = new Date(agora); hoje24.setHours(23, 59, 59, 999)

  switch (periodo) {
    case 'hoje':
      return pedidos.filter(p => {
        const d = new Date(p.data)
        return d >= hoje0 && d <= hoje24
      })
    case 'ontem': {
      const ini = new Date(hoje0); ini.setDate(ini.getDate() - 1)
      const fim = new Date(ini); fim.setHours(23, 59, 59, 999)
      return pedidos.filter(p => { const d = new Date(p.data); return d >= ini && d <= fim })
    }
    case '7d': {
      const ini = new Date(hoje0); ini.setDate(ini.getDate() - 7)
      return pedidos.filter(p => new Date(p.data) >= ini)
    }
    case '30d': {
      const ini = new Date(hoje0); ini.setDate(ini.getDate() - 30)
      return pedidos.filter(p => new Date(p.data) >= ini)
    }
    default:
      return pedidos
  }
}

// --- API pública ---

export async function getPedidosPorPeriodo(periodo: string): Promise<{
  pedidos: PedidoNorm[]
  total_pedidos: number
  total_valor: number
}> {
  // Para períodos curtos, busca os 200 mais recentes e filtra
  // Para 30d, busca 500
  const limit = periodo === '30d' ? 500 : 200
  const { objects, total } = await fetchPedidos(limit)
  const normalizados = objects.map(normalizar)
  const filtrados = filtrarPorPeriodo(normalizados, periodo)

  const total_valor = filtrados.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)

  return { pedidos: filtrados, total_pedidos: filtrados.length, total_valor }
}

export async function getCashflowSemanal(): Promise<Array<{ data: string; entradas: number; saidas: number; saldo: number }>> {
  const { objects } = await fetchPedidos(500)
  const normalizados = objects.map(normalizar)

  // Últimos 7 dias
  const dias: Array<{ data: string; entradas: number; saidas: number; saldo: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)

    const do_dia = normalizados.filter(p => {
      const pd = new Date(p.data)
      return pd >= ini && pd <= fim
    })
    const entradas = do_dia.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    dias.push({ data: chave, entradas, saidas: 0, saldo: entradas })
  }
  return dias
}

export async function getCashflowPorDias(dias_n: number): Promise<{
  cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }>
  total_entradas: number
}> {
  const { objects } = await fetchPedidos(500)
  const normalizados = objects.map(normalizar)

  const resultado = []
  for (let i = dias_n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)

    const do_dia = normalizados.filter(p => {
      const pd = new Date(p.data); return pd >= ini && pd <= fim
    })
    const entradas = do_dia.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    resultado.push({ data: chave, entradas, saidas: 0, saldo: entradas })
  }

  const total_entradas = resultado.reduce((s, d) => s + d.entradas, 0)
  return { cashflow: resultado, total_entradas }
}
