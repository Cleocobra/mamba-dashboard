import { NextRequest, NextResponse } from 'next/server'
import { getPedidosDesde, localYMD } from '@/lib/lojaintegrada'

// Entradas por dia (gráfico do dashboard). Agrupamento em dia LOCAL do
// servidor (TZ=America/Sao_Paulo) — nunca toISOString, que desloca pra UTC.

export async function GET(request: NextRequest) {
  const sp  = request.nextUrl.searchParams
  const de  = sp.get('de')
  const ate = sp.get('ate')

  let inicio: Date
  let fim: Date
  if (de && ate) {
    inicio = new Date(de + 'T00:00:00')
    fim    = new Date(ate + 'T23:59:59.999')
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 })
    }
  } else {
    const dias = Math.min(Math.max(parseInt(sp.get('dias') || '7'), 1), 90)
    fim = new Date(); fim.setHours(23, 59, 59, 999)
    inicio = new Date(); inicio.setDate(inicio.getDate() - (dias - 1)); inicio.setHours(0, 0, 0, 0)
  }

  try {
    const todos = await getPedidosDesde(inicio)

    const porDia: Record<string, number> = {}
    for (const p of todos) {
      if (!p.data || p.status_pagamento === 'cancelado') continue
      const d = new Date(p.data)
      if (d < inicio || d > fim) continue
      const k = localYMD(d)
      porDia[k] = (porDia[k] || 0) + (parseFloat(p.valor_total || '0') || 0)
    }

    const cashflow: Array<{ data: string; entradas: number; saidas: number; saldo: number }> = []
    const cur = new Date(inicio)
    while (cur <= fim) {
      const k = localYMD(cur)
      const entradas = porDia[k] || 0
      cashflow.push({ data: k, entradas, saidas: 0, saldo: entradas })
      cur.setDate(cur.getDate() + 1)
    }

    return NextResponse.json({
      cashflow,
      total_entradas: cashflow.reduce((s, d) => s + d.entradas, 0),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `Falha: ${error.message}`, cashflow: [], total_entradas: 0 },
      { status: 500 }
    )
  }
}
