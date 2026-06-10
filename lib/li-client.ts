// Camada de dados do dashboard — consome a API interna do próprio painel.
// As chaves da Loja Integrada ficam APENAS no servidor (.env da instância):
// nunca colocar credencial aqui, este código vai no bundle do navegador.

export interface PedidoNorm {
  id: number
  numero: string
  data: string
  cliente: string
  status: string
  status_pagamento: string
  valor_total: string
}

async function getJson(url: string): Promise<any> {
  const res  = await fetch(url, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `API ${res.status}`)
  return data
}

export async function getPedidosPorPeriodo(periodo: string): Promise<{
  pedidos: PedidoNorm[]
  total_pedidos: number
  total_valor: number
}> {
  const d = await getJson(`/api/pedidos?periodo=${encodeURIComponent(periodo)}`)
  return { pedidos: d.pedidos || [], total_pedidos: d.total_pedidos || 0, total_valor: d.total_valor || 0 }
}

export async function getPedidosPorDatas(de: string, ate: string): Promise<{
  pedidos: PedidoNorm[]
  total_pedidos: number
  total_valor: number
}> {
  const d = await getJson(`/api/pedidos?periodo=personalizado&de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
  return { pedidos: d.pedidos || [], total_pedidos: d.total_pedidos || 0, total_valor: d.total_valor || 0 }
}

export async function getCashflowPorDias(dias_n: number): Promise<{
  cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }>
  total_entradas: number
}> {
  const d = await getJson(`/api/cashflow?dias=${dias_n}`)
  return { cashflow: d.cashflow || [], total_entradas: d.total_entradas || 0 }
}

export async function getCashflowPorDatas(de: string, ate: string): Promise<{
  cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }>
  total_entradas: number
}> {
  const d = await getJson(`/api/cashflow?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
  return { cashflow: d.cashflow || [], total_entradas: d.total_entradas || 0 }
}
