// Chamadas à Loja Integrada feitas client-side (navegador)
// CORS: access-control-allow-origin: * — funciona no browser
// Limit máximo por request: 100
// IMPORTANTE: A LI retorna pedidos em ordem CRESCENTE (mais antigo primeiro)
// Por isso buscamos do FINAL da lista para pegar os mais recentes

const BASE = 'https://api.awsli.com.br/v1'
const CHAVE_API = 'c9b02688ef5097ab6a26'
const CHAVE_APLICACAO = 'df63ca80-5968-4476-9b43-11189846cb9a'
const MAX_LIMIT = 100

function buildUrl(path: string, params: Record<string, string | number> = {}): string {
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

// Busca uma página (máx 100 por request)
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

// Busca pedidos mais recentes em ordem inversa (do final para o início)
// A LI retorna mais antigo primeiro, então os pedidos de hoje estão no fim da lista
async function fetchRecentesPorPeriodo(inicioPeriodo: Date): Promise<PedidoNorm[]> {
  // Passo 1: descobre o total de pedidos
  const { total } = await fetchPagina(1, 0)
  if (total === 0) return []

  const resultado: PedidoNorm[] = []
  const MAX_PAGINAS = 6  // até 600 pedidos retroativos

  // Começa pelo offset do final da lista (pedidos mais recentes)
  let offset = Math.max(0, total - MAX_LIMIT)
  let paginas = 0

  while (paginas < MAX_PAGINAS) {
    const { objects } = await fetchPagina(MAX_LIMIT, offset)
    if (objects.length === 0) break

    const normalizados = objects.map(normalizar)

    // Filtra só os que têm data
    const comData = normalizados.filter(p => !!p.data)
    resultado.push(...comData)

    // O mais antigo dessa página (primeiro item = ordem crescente)
    const maisAntigo = comData[0]
    const dataMaisAntiga = maisAntigo ? new Date(maisAntigo.data) : new Date()

    // Se o mais antigo desta página já é anterior ao período, temos tudo que precisamos
    if (dataMaisAntiga < inicioPeriodo) break

    // Se chegamos ao início, para
    if (offset === 0) break

    // Vai para a página anterior
    offset = Math.max(0, offset - MAX_LIMIT)
    paginas++
  }

  return resultado
}

// Filtro de período client-side
function filtrarPorPeriodo(pedidos: PedidoNorm[], periodo: string): PedidoNorm[] {
  const agora = new Date()
  const hoje0  = new Date(agora); hoje0.setHours(0, 0, 0, 0)
  const hoje24 = new Date(agora); hoje24.setHours(23, 59, 59, 999)

  switch (periodo) {
    case 'hoje':
      return pedidos.filter(p => {
        const d = new Date(p.data); return d >= hoje0 && d <= hoje24
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

function getInicioPeriodo(periodo: string): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (periodo === 'ontem') { const o = new Date(d); o.setDate(o.getDate() - 1); return o }
  if (periodo === '7d')   { const s = new Date(d); s.setDate(s.getDate() - 7);  return s }
  if (periodo === '30d')  { const m = new Date(d); m.setDate(m.getDate() - 30); return m }
  return d // hoje
}

// --- API pública ---

export async function getPedidosPorPeriodo(periodo: string): Promise<{
  pedidos: PedidoNorm[]
  total_pedidos: number
  total_valor: number
}> {
  const inicio = getInicioPeriodo(periodo)
  const todos = await fetchRecentesPorPeriodo(inicio)
  const filtrados = filtrarPorPeriodo(todos, periodo)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()) // mais novo primeiro
  const total_valor = filtrados.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
  return { pedidos: filtrados, total_pedidos: filtrados.length, total_valor }
}

export async function getCashflowSemanal(): Promise<Array<{ data: string; entradas: number; saidas: number; saldo: number }>> {
  const inicio = new Date(); inicio.setDate(inicio.getDate() - 7); inicio.setHours(0, 0, 0, 0)
  const todos = await fetchRecentesPorPeriodo(inicio)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    const entradas = todos
      .filter(p => { const pd = new Date(p.data); return pd >= ini && pd <= fim })
      .reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    return { data: chave, entradas, saidas: 0, saldo: entradas }
  })
}

export async function getCashflowPorDias(dias_n: number): Promise<{
  cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }>
  total_entradas: number
}> {
  const inicio = new Date(); inicio.setDate(inicio.getDate() - dias_n); inicio.setHours(0, 0, 0, 0)
  const todos = await fetchRecentesPorPeriodo(inicio)

  const cashflow = Array.from({ length: dias_n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (dias_n - 1 - i))
    const chave = d.toISOString().split('T')[0]
    const ini = new Date(d); ini.setHours(0, 0, 0, 0)
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    const entradas = todos
      .filter(p => { const pd = new Date(p.data); return pd >= ini && pd <= fim })
      .reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    return { data: chave, entradas, saidas: 0, saldo: entradas }
  })

  return { cashflow, total_entradas: cashflow.reduce((s, d) => s + d.entradas, 0) }
}

// Busca pedidos por datas personalizadas (dashboard personalizado)
export async function getPedidosPorDatas(de: string, ate: string) {
  const inicio = new Date(de  + 'T00:00:00')
  const fim    = new Date(ate + 'T23:59:59')
  const todos  = await fetchRecentesPorPeriodo(inicio)
  const filtrados = todos
    .filter(p => { const d = new Date(p.data); return d >= inicio && d <= fim })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  const total_valor = filtrados.reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
  return { pedidos: filtrados, total_pedidos: filtrados.length, total_valor }
}

export async function getCashflowPorDatas(de: string, ate: string) {
  const inicio = new Date(de  + 'T00:00:00')
  const fim    = new Date(ate + 'T23:59:59')
  const todos  = await fetchRecentesPorPeriodo(inicio)

  const days: Array<{ data: string; entradas: number; saidas: number; saldo: number }> = []
  const cur = new Date(inicio)
  while (cur <= fim) {
    const chave = cur.toISOString().split('T')[0]
    const ini = new Date(cur); ini.setHours(0, 0, 0, 0)
    const f   = new Date(cur); f.setHours(23, 59, 59, 999)
    const entradas = todos
      .filter(p => { const pd = new Date(p.data); return pd >= ini && pd <= f })
      .reduce((s, p) => s + parseFloat(p.valor_total || '0'), 0)
    days.push({ data: chave, entradas, saidas: 0, saldo: entradas })
    cur.setDate(cur.getDate() + 1)
  }
  return { cashflow: days, total_entradas: days.reduce((s, d) => s + d.entradas, 0) }
}
