import { NextRequest, NextResponse } from 'next/server'
import { getPedidosDesde } from '@/lib/lojaintegrada'

// Pedidos da loja por período, com dados SEMPRE da instância (chaves no .env
// do servidor). Limites calculados no fuso do servidor (TZ=America/Sao_Paulo).

function periodoRange(periodo: string, de?: string | null, ate?: string | null) {
  const ini = new Date(); ini.setHours(0, 0, 0, 0)
  const fim = new Date(); fim.setHours(23, 59, 59, 999)
  switch (periodo) {
    case 'ontem':
      ini.setDate(ini.getDate() - 1)
      fim.setDate(fim.getDate() - 1)
      break
    case '7d':
      ini.setDate(ini.getDate() - 7)
      break
    case '30d':
      ini.setDate(ini.getDate() - 30)
      break
    case 'personalizado': {
      if (de) {
        const d = new Date(de + 'T00:00:00')
        if (!isNaN(d.getTime())) ini.setTime(d.getTime())
      }
      if (ate) {
        const d = new Date(ate + 'T23:59:59.999')
        if (!isNaN(d.getTime())) fim.setTime(d.getTime())
      }
      break
    }
  }
  return { ini, fim }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const periodo = sp.get('periodo') || 'hoje'
  const { ini, fim } = periodoRange(periodo, sp.get('de'), sp.get('ate'))

  try {
    const todos = await getPedidosDesde(ini)

    const doPeriodo = todos
      .filter((p: any) => {
        if (!p.data) return false
        const d = new Date(p.data).getTime()
        return d >= ini.getTime() && d <= fim.getTime()
      })
      .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())

    // Cards somam só pedidos não-cancelados; a lista mostra todos (com status)
    const validos = doPeriodo.filter((p: any) => p.status_pagamento !== 'cancelado')
    const total_valor = validos.reduce(
      (s: number, p: any) => s + (parseFloat(p.valor_total || '0') || 0), 0)

    return NextResponse.json({
      pedidos: doPeriodo,
      total_pedidos: validos.length,
      total_cancelados: doPeriodo.length - validos.length,
      total_valor,
      periodo,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `Falha ao buscar pedidos: ${error.message}` },
      { status: 500 }
    )
  }
}
