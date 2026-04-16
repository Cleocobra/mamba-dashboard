import { NextRequest, NextResponse } from 'next/server'
import { getPedidos, normalizarPedidos, agruparPedidosPorDia } from '@/lib/lojaintegrada'
import { getLastNDays } from '@/lib/utils'
import type { CashFlowEntry } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dias = parseInt(searchParams.get('dias') || '7')

  try {
    // Busca pedidos recentes (500 para cobrir o período)
    const result = await getPedidos({ limit: 500 })
    const raw = result.objects || []
    const pedidos = normalizarPedidos(raw)

    // Filtra pelo período solicitado
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - dias)
    inicio.setHours(0, 0, 0, 0)
    const pedidosFiltrados = pedidos.filter((p) => {
      if (!p.data) return false
      return new Date(p.data).getTime() >= inicio.getTime()
    })

    const porDia = agruparPedidosPorDia(pedidosFiltrados)
    const labels = getLastNDays(dias)

    const cashflow: CashFlowEntry[] = labels.map((data) => {
      const entradas = porDia[data]?.entradas || 0
      return {
        data,
        entradas,
        saidas: 0, // Saídas manuais ainda não persistidas
        saldo: entradas,
      }
    })

    const total_entradas = cashflow.reduce((a, c) => a + c.entradas, 0)
    const total_saidas = 0
    const saldo_periodo = total_entradas

    return NextResponse.json({
      cashflow,
      summary: {
        total_entradas,
        total_saidas,
        saldo_periodo,
        dias,
      },
    })
  } catch (error: any) {
    console.error('Erro ao buscar fluxo de caixa:', error)
    return NextResponse.json(
      { error: `Falha: ${error.message}`, cashflow: [], summary: { total_entradas: 0, total_saidas: 0, saldo_periodo: 0 } },
      { status: 500 }
    )
  }
}
