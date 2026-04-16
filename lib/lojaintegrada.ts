const BASE_URL = 'https://api.awsli.com.br/v1'
const CHAVE_API = process.env.LI_CHAVE_API || 'c9b02688ef5097ab6a26'
const CHAVE_APLICACAO = process.env.LI_CHAVE_APLICACAO || 'df63ca80-5968-4476-9b43-11189846cb9a'

const headers = {
  'Authorization': `chave_api ${CHAVE_API}:${CHAVE_APLICACAO}`,
  'Content-Type': 'application/json',
}

export async function getPedidos(params: {
  data_inicio?: string
  data_fim?: string
  status?: string
  limit?: number
  offset?: number
} = {}) {
  const query = new URLSearchParams()

  if (params.data_inicio) query.set('criado_em__gte', params.data_inicio)
  if (params.data_fim) query.set('criado_em__lte', params.data_fim)
  if (params.status) query.set('status', params.status)
  query.set('limit', String(params.limit || 50))
  query.set('offset', String(params.offset || 0))

  const res = await fetch(`${BASE_URL}/pedido/?${query.toString()}`, {
    headers,
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`Loja Integrada API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function getPedidoDetalhe(id: number) {
  const res = await fetch(`${BASE_URL}/pedido/${id}/`, {
    headers,
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`Loja Integrada API error: ${res.status}`)
  }

  return res.json()
}

export async function getPedidosHoje() {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(hoje)
  fim.setHours(23, 59, 59, 999)

  return getPedidos({
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
    limit: 100,
  })
}

export async function getPedidosPeriodo(dias: number) {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - dias)

  return getPedidos({
    data_inicio: inicio.toISOString(),
    data_fim: hoje.toISOString(),
    limit: 200,
  })
}

export function calcularTotalPedidos(pedidos: any[]): number {
  return pedidos.reduce((acc: number, p: any) => {
    const valor = parseFloat(p.valor_total || '0')
    return acc + valor
  }, 0)
}

export function agruparPedidosPorDia(pedidos: any[]): Record<string, { entradas: number; quantidade: number }> {
  const agrupado: Record<string, { entradas: number; quantidade: number }> = {}

  for (const p of pedidos) {
    const data = p.criado_em?.split('T')[0] || p.data_criacao?.split('T')[0]
    if (!data) continue
    if (!agrupado[data]) agrupado[data] = { entradas: 0, quantidade: 0 }
    agrupado[data].entradas += parseFloat(p.valor_total || '0')
    agrupado[data].quantidade += 1
  }

  return agrupado
}
