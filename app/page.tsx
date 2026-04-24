'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import CashFlowChart from '@/components/CashFlowChart'
import OrdersTable from '@/components/OrdersTable'
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  Wallet, ReceiptText, Activity, ArrowUpRight, Calendar,
} from 'lucide-react'
import { formatBRL } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  getPedidosPorPeriodo, getCashflowPorDias, getCashflowPorDatas,
  getPedidosPorDatas, type PedidoNorm,
} from '@/lib/li-client'
import type { CashFlowEntry } from '@/lib/types'

type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | 'personalizado'

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: 'Hoje', ontem: 'Ontem', '7d': '7 dias', '30d': '30 dias', personalizado: 'Personalizado',
}

export default function DashboardPage() {
  const [periodo,      setPeriodo]      = useState<Periodo>('hoje')
  const [dataInicio,   setDataInicio]   = useState('')
  const [dataFim,      setDataFim]      = useState('')
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cashflow,     setCashflow]     = useState<CashFlowEntry[]>([])
  const [pedidos,      setPedidos]      = useState<PedidoNorm[]>([])
  const [summary,      setSummary]      = useState({
    entradas: 0, saidas: 0, saldo: 0, qtd_pedidos: 0, ticket_medio: 0, total_chart: 0,
  })
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (p: Periodo, di: string, df: string) => {
    if (p === 'personalizado' && (!di || !df)) return
    setError(null)
    try {
      if (p === 'personalizado') {
        const [pedResult, cfResult] = await Promise.all([
          getPedidosPorDatas(di, df),
          getCashflowPorDatas(di, df),
        ])
        setCashflow(cfResult.cashflow)
        setPedidos(pedResult.pedidos.slice(0, 10))
        const ticket = pedResult.total_pedidos > 0 ? pedResult.total_valor / pedResult.total_pedidos : 0
        setSummary({
          entradas: pedResult.total_valor, saidas: 0, saldo: pedResult.total_valor,
          qtd_pedidos: pedResult.total_pedidos, ticket_medio: ticket,
          total_chart: cfResult.total_entradas,
        })
      } else {
        const chartDias = p === '30d' ? 30 : 7
        const [pedResult, cfResult] = await Promise.all([
          getPedidosPorPeriodo(p),
          getCashflowPorDias(chartDias),
        ])
        setCashflow(cfResult.cashflow)
        setPedidos(pedResult.pedidos.slice(0, 10))
        const ticket = pedResult.total_pedidos > 0 ? pedResult.total_valor / pedResult.total_pedidos : 0
        setSummary({
          entradas: pedResult.total_valor, saidas: 0, saldo: pedResult.total_valor,
          qtd_pedidos: pedResult.total_pedidos, ticket_medio: ticket,
          total_chart: cfResult.total_entradas,
        })
      }
    } catch (err: any) {
      setError('Falha ao carregar dados: ' + err.message)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData(periodo, dataInicio, dataFim)
    setIsRefreshing(false)
  }

  useEffect(() => {
    setIsLoading(true)
    fetchData(periodo, dataInicio, dataFim).finally(() => setIsLoading(false))
  }, [fetchData, periodo, dataInicio, dataFim])

  const chartTitle =
    periodo === '30d'         ? 'Últimos 30 dias' :
    periodo === 'personalizado' ? 'Período selecionado' : 'Últimos 7 dias'

  const labelComparativo =
    periodo === '30d'         ? 'Total — 30 dias' :
    periodo === 'personalizado' ? 'Total — Período' : 'Total — 7 dias'

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Header title="Dashboard Operacional" onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 space-y-6">

          {/* ── Seletor de período ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex bg-mamba-card border border-mamba-border rounded-xl p-1 gap-1 flex-wrap">
              {(['hoje', 'ontem', '7d', '30d', 'personalizado'] as Periodo[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap',
                    periodo === p
                      ? 'bg-mamba-gold text-mamba-black'
                      : 'text-mamba-silver hover:text-mamba-white hover:bg-mamba-border'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {PERIODO_LABELS[p]}
                </button>
              ))}
            </div>
            {periodo === 'personalizado' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date" value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="input-mamba rounded-lg px-3 py-1.5 text-xs"
                />
                <span className="text-mamba-silver/40 text-xs">até</span>
                <input
                  type="date" value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="input-mamba rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <Activity className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Métricas ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <MetricCard
              label={`Entradas — ${PERIODO_LABELS[periodo]}`}
              value={summary.entradas}      isCurrency icon={TrendingUp}  accentColor="green"   animationDelay="0ms"   />
            <MetricCard
              label="Saídas"
              value={summary.saidas}        isCurrency icon={TrendingDown} accentColor="red"     animationDelay="50ms"  />
            <MetricCard
              label={`Saldo — ${PERIODO_LABELS[periodo]}`}
              value={summary.saldo}         isCurrency icon={Wallet}       accentColor={summary.saldo >= 0 ? 'gold' : 'red'} animationDelay="100ms" />
            <MetricCard
              label={`Pedidos — ${PERIODO_LABELS[periodo]}`}
              value={summary.qtd_pedidos}              icon={ShoppingBag}  accentColor="blue"    animationDelay="150ms" />
            <MetricCard
              label="Ticket Médio"
              value={summary.ticket_medio}  isCurrency icon={ReceiptText}  accentColor="default" animationDelay="200ms" />
            <MetricCard
              label={labelComparativo}
              value={summary.total_chart}   isCurrency icon={DollarSign}   accentColor="gold"    animationDelay="250ms" />
          </div>

          {/* ── Gráfico + Resumo ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-mamba-white tracking-wide">Fluxo de Caixa</h3>
                  <p className="text-xs text-mamba-silver mt-0.5">{chartTitle}</p>
                </div>
              </div>
              {isLoading ? (
                <div className="h-[280px] flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-mamba-gold/30 border-t-mamba-gold rounded-full animate-spin" />
                </div>
              ) : (
                <CashFlowChart data={cashflow} />
              )}
            </div>

            <div className="space-y-4">
              {/* Resumo do período */}
              <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-4">
                <h3 className="text-xs font-bold tracking-wider text-mamba-silver uppercase mb-4">
                  {chartTitle}
                </h3>
                <div className="space-y-3">
                  {cashflow.slice(-5).map((day) => {
                    const [, m, d] = day.data.split('-')
                    const max = Math.max(...cashflow.map(c => c.entradas), 1)
                    const pct = Math.min(100, (day.entradas / max) * 100)
                    return (
                      <div key={day.data}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-mamba-silver font-mono">{d}/{m}</span>
                          <span className="text-xs font-bold text-mamba-white tabular-nums">{formatBRL(day.entradas)}</span>
                        </div>
                        <div className="h-1.5 bg-mamba-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-mamba-gold to-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-5">
                <h3 className="text-xs font-bold tracking-wider text-mamba-silver uppercase mb-3">Acesso Rápido</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Ver todos os pedidos', href: '/pedidos', color: 'text-mamba-gold' },
                    { label: 'Fluxo de Caixa',       href: '/fluxo',   color: 'text-green-400' },
                    { label: 'Meta Ads',              href: '/anuncios',color: 'text-blue-400'  },
                  ].map(item => (
                    <a key={item.href} href={item.href}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-mamba-dark transition-colors duration-150 cursor-pointer group"
                    >
                      <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-mamba-silver/40 group-hover:text-mamba-silver transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Pedidos Recentes ─────────────────────────────────── */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Pedidos Recentes</h3>
                <p className="text-xs text-mamba-silver mt-0.5">
                  Últimos pedidos — {PERIODO_LABELS[periodo]}
                </p>
              </div>
              <a href="/pedidos"
                className="flex items-center gap-1.5 text-xs font-semibold text-mamba-gold hover:text-mamba-gold/80 transition-colors cursor-pointer"
              >
                Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="overflow-x-auto">
              <OrdersTable pedidos={pedidos} isLoading={isLoading} />
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
