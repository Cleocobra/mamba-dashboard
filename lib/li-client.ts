// Chamadas à Loja Integrada feitas client-side (navegador)
// CORS: access-control-allow-origin: * — funciona no browser
// Limit máximo por request: 100

const BASE = 'https://api.awsli.com.br/v1'
const CHAVE_API = 'c9b02688ef5097ab6a26'
const CHAVE_APLICACAO = 'df63ca80-5968-4476-9b43-11189846cb9a'
const MAX_LIMIT = 100

function buildUrl(path: string, params: Record<string, string | number> = {}): string {
  // Usa string direta para evitar problemas de encoding
  const base = `chave_api=${CHAVE_API}&chave_aplicacao=${CHAVE_APLICACAO}`
  const extra = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return `${BASE}${path}?${base}${extra ? '&' + extra : ''}`
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

// Busca uma página de pedidos (máx 100 por request)
async function fetchPagina(limit: number, offset: number): Promise<{ objects: any[]; total: number }> {
  const safeLimit = Math.min(limit, MAX_LIMIT)
  const res = await fetch(buildUrl('/pedido/', { limit: safeLimit, offset }), {
    headers: { 'Accept': 'application/json' },
    credentials: 'omit',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body}`)
  }
  const data = await res.json()
  return { objects: data.objects || [], total: data.meta?.total_count || 0 }
}

// Busca múltiplas páginas até cobrir o período necessário
// A LI retorna em ordem decrescente de criação (mais recente primeiro)
async function fetchTodosNoPeriodo(inicioPeriodo: Date): Promise<PedidoNorm[]> {
  const resultado: PedidoNorm[] = []
  let offset = 0
  let total = Infinity

  while (offset < total) {
    const { objects, total: t } = await fetchPagina(MAX_LIMIT, offset)
    total = t

    if (objects.length === 0) break

    const normalizados = objects.map(normalizar)

    // O mais antigo desta página
    const maisAntigo = normalizados[normalizados.length - 1]
    const dataMaisAntiga = maisAntigo.data ? new Date(maisAntigo.data) : new Date()

    resultado.push(...normalizados)

    // Se o mais antigo da página já está antes do início do período, paramos
    if (dataMaisAntiga < inicioPeriodo) break

    offset += MAX_LIMIT

    // Segurança: no máximo 5 páginas (500 pedidos)
    if (offset >= 500) break
  }

  return resultado
}

// Filtra por período client-side
function filtrarPorPeriodo(pedidos: PedidoNorm[], periodo: string): PedidoNorm[] {
  const agora = new Date()
  const hoje0  = new Date(agora); hoje0.setHours(0, 0, 0, 0)
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

function inicioPeriodo(periodo: string): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  switch (periodo) {
    case 'hoje':  return d
    case 'ontem': { const o = new Date(d); o.setDate(o.getDate() - 1); return o }
    case '7d':   { const s = new Date(d); s.setDate(s.getDate() - 7);  return s }
    case '30d':  { const m = new Date(d); m.setDate(m.getDate() - 30); return m }
    default:     return d
  }
}

// --- API pública ---

export async function getPedidosPorPeriodo(periodo: string): Promise<{
  pedidos: PedidoNorm[]
  total_pedidos: number
  total_valor: number
}> {
  const inicio = inicioPeriodo(periodo)
  const todos = await fetchTodosNoPeriodo(inicio)
  const filtrados = filtrarPorPeriodo(todos, periodo)
  const total_valor = filtrados.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
  return { pedidos: filtrados, total_pedidos: filtrados.length, total_valor }
}

export async function getCashflowSemanal(): Promise<Array<{ data: string; entradas: number; saidas: number; saldo: number }>> {
  const inicio = new Date(); inicio.setDate(inicio.getDate() - 7); inicio.setHours(0, 0, 0, 0)
  const todos = await fetchTodosNoPeriodo(inicio)

  const dias = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    const do_dia = todos.filter(p => { const pd = new Date(p.data); return pd >= ini && pd <= fim })
    const entradas = do_dia.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    dias.push({ data: chave, entradas, saidas: 0, saldo: entradas })
  }
  return dias
}

export async function getCashflowPorDias(dias_n: number): Promise<{
  cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }>
  total_entradas: number
}> {
  const inicio = new Date(); inicio.setDate(inicio.getDate() - dias_n); inicio.setHours(0, 0, 0, 0)
  const todos = await fetchTodosNoPeriodo(inicio)

  const resultado = []
  for (let i = dias_n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    const do_dia = todos.filter(p => { const pd = new Date(p.data); return pd >= ini && pd <= fim })
    const entradas = do_dia.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    resultado.push({ data: chave, entradas, saidas: 0, saldo: entradas })
  }

  const total_entradas = resultado.reduce((s, d) => s + d.entradas, 0)
  return { cashflow: resultado, total_entradas }
}
