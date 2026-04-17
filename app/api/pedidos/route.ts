import { NextRequest, NextResponse } from 'next/server'
import { getPedidos, normalizarPedidos, calcularTotalPedidos, agruparPedidosPorDia } from '@/lib/lojaintegrada'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || 'hoje'
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const hoje = new Date()

    // Busca todos os pedidos (a LI não filtra bem por data na API)
    // Filtramos client-side depois
    const result = await getPedidos({ limit: 100, offset })
    const raw = result.objects || []
    const total_api = result.meta?.total_count || raw.length

    // Normaliza campos
    const todos = normalizarPedidos(raw)

    // Filtra por período client-side
    const inicio = calcularInicio(periodo, hoje)
    const fim = calcularFim(periodo, hoje)

    const filtrados = todos.filter((p) => {
      if (!p.data) return false
      const d = new Date(p.data).getTime()
      return d >= inicio.getTime() && d <= fim.getTime()
    })

    const total_valor = calcularTotalPedidos(filtrados)
    const por_dia = agruparPedidosPorDia(filtrados)

    return NextResponse.json({
      pedidos: filtrados.slice(0, parseInt(searchParams.get('limit') || '100')),
      meta: {
        total_pedidos: filtrados.length,
        total_valor,
        por_dia,
        periodo,
        total_loja: total_api,
      },
    })
  } catch (error: any) {
    console.error('Erro ao buscar pedidos:', error)
    return NextResponse.json(
      { error: `Falha ao buscar pedidos: ${error.message}`, pedidos: [], meta: { total_pedidos: 0, total_valor: 0 } },
      { status: 500 }
    )
  }
}

function calcularInicio(periodo: string, hoje: Date): Date {
  const d = new Date(hoje)
  switch (periodo) {
    case 'hoje':
      d.setHours(0, 0, 0, 0)
      return d
    case 'ontem': {
      const ontem = new Date(hoje)
      ontem.setDate(ontem.getDate() - 1)
      ontem.setHours(0, 0, 0, 0)
      return ontem
    }
    case '7d':
      d.setDate(d.getDate() - 7)
      d.setHours(0, 0, 0, 0)
      return d
    case '30d':
      d.setDate(d.getDate() - 30)
      d.setHours(0, 0, 0, 0)
      return d
    default:
      d.setHours(0, 0, 0, 0)
      return d
  }
}

function calcularFim(periodo: string, hoje: Date): Date {
  if (periodo === 'ontem') {
    const d = new Date(hoje)
    d.setDate(d.getDate() - 1)
    d.setHours(23, 59, 59, 999)
    return d
  }
  const d = new Date(hoje)
  d.setHours(23, 59, 59, 999)
  return d
}
