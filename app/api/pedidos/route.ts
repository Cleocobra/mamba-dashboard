import { NextRequest, NextResponse } from 'next/server'
import { getPedidos, agruparPedidosPorDia, calcularTotalPedidos } from '@/lib/lojaintegrada'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || 'hoje'
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const status = searchParams.get('status') || undefined

  try {
    const hoje = new Date()

    let data_inicio: Date
    let data_fim: Date = new Date(hoje)
    data_fim.setHours(23, 59, 59, 999)

    switch (periodo) {
      case 'hoje':
        data_inicio = new Date(hoje)
        data_inicio.setHours(0, 0, 0, 0)
        break
      case 'ontem':
        data_inicio = new Date(hoje)
        data_inicio.setDate(data_inicio.getDate() - 1)
        data_inicio.setHours(0, 0, 0, 0)
        data_fim = new Date(hoje)
        data_fim.setDate(data_fim.getDate() - 1)
        data_fim.setHours(23, 59, 59, 999)
        break
      case '7d':
        data_inicio = new Date(hoje)
        data_inicio.setDate(data_inicio.getDate() - 7)
        data_inicio.setHours(0, 0, 0, 0)
        break
      case '30d':
        data_inicio = new Date(hoje)
        data_inicio.setDate(data_inicio.getDate() - 30)
        data_inicio.setHours(0, 0, 0, 0)
        break
      default:
        // Custom range: periodo=2024-01-01_2024-01-31
        const parts = periodo.split('_')
        data_inicio = parts[0] ? new Date(parts[0]) : new Date(hoje)
        data_fim = parts[1] ? new Date(parts[1]) : new Date(hoje)
    }

    const result = await getPedidos({
      data_inicio: data_inicio.toISOString(),
      data_fim: data_fim.toISOString(),
      status,
      limit,
      offset,
    })

    const pedidos = result.objects || result.results || []
    const total_valor = calcularTotalPedidos(pedidos)
    const por_dia = agruparPedidosPorDia(pedidos)

    return NextResponse.json({
      pedidos,
      meta: {
        total_pedidos: result.meta?.total_count || pedidos.length,
        total_valor,
        por_dia,
        periodo,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar pedidos da Loja Integrada', details: String(error) },
      { status: 500 }
    )
  }
}
