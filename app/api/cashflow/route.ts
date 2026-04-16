import { NextRequest, NextResponse } from 'next/server'
import { getPedidos, agruparPedidosPorDia } from '@/lib/lojaintegrada'
import { getLastNDays } from '@/lib/utils'
import type { CashFlowEntry } from '@/lib/types'

// Saídas são registradas manualmente (sem integração automática ainda)
// No futuro: integrar com sistema financeiro/ERP
const SAIDAS_MOCK: Record<string, number> = {}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dias = parseInt(searchParams.get('dias') || '7')

  try {
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - dias)
    inicio.setHours(0, 0, 0, 0)

    const result = await getPedidos({
      data_inicio: inicio.toISOString(),
      data_fim: hoje.toISOString(),
      limit: 500,
    })

    const pedidos = result.objects || result.results || []
    const porDia = agruparPedidosPorDia(pedidos)
    const labels = getLastNDays(dias)

    const cashflow: CashFlowEntry[] = labels.map((data) => {
      const entradas = porDia[data]?.entradas || 0
      const saidas = SAIDAS_MOCK[data] || 0
      return {
        data,
        entradas,
        saidas,
        saldo: entradas - saidas,
      }
    })

    const total_entradas = cashflow.reduce((a, c) => a + c.entradas, 0)
    const total_saidas = cashflow.reduce((a, c) => a + c.saidas, 0)
    const saldo_periodo = total_entradas - total_saidas

    return NextResponse.json({
      cashflow,
      summary: {
        total_entradas,
        total_saidas,
        saldo_periodo,
        dias,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar fluxo de caixa:', error)
    return NextResponse.json(
      { error: 'Falha ao calcular fluxo de caixa', details: String(error) },
      { status: 500 }
    )
  }
}
