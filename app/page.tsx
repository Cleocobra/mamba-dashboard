'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import MetricCard from '@/components/MetricCard'
import CashFlowChart from '@/components/CashFlowChart'
import OrdersTable from '@/components/OrdersTable'
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  Wallet, ReceiptText, Activity, ArrowUpRight,
} from 'lucide-react'
import { formatBRL } from '@/lib/utils'
import { getPedidosPorPeriodo, getCashflowSemanal, type PedidoNorm } from '@/lib/li-client'
import type { CashFlowEntry } from '@/lib/types'

export default function DashboardPage() {
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cashflow,     setCashflow]     = useState<CashFlowEntry[]>([])
  const [pedidosHoje,  setPedidosHoje]  = useState<PedidoNorm[]>([])
  const [summary,      setSummary]      = useState({
    entradas_hoje: 0, saidas_hoje: 0, saldo_hoje: 0,
    pedidos_hoje: 0,  ticket_medio: 0, total_semana: 0,
  })
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [hoje, semana] = await Promise.all([
        getPedidosPorPeriodo('hoje'),
        getCashflowSemanal(),
      ])

      setCashflow(semana)
      setPedidosHoje(hoje.pedidos.slice(0, 10))

      const total_semana = semana.reduce((s, d) => s + d.entradas, 0)
      const ticket = hoje.total_pedidos > 0 ? hoje.total_valor / hoje.total_pedidos : 0

      setSummary({
        entradas_hoje: hoje.total_valor,
        saidas_hoje:   0,
        saldo_hoje:    hoje.total_valor,
        pedidos_hoje:  hoje.total_pedidos,
        ticket_medio:  ticket,
        total_semana,
      })
      setError(null)
    } catch (err: any) {
      setError('Falha ao carregar dados: ' + err.message)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [fetchData])

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header title="Dashboard Operacional" onRefresh={handleRefresh} isRefreshing={isRefreshing} />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <Activity className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <MetricCard label="Entradas Hoje"  value={summary.entradas_hoje} isCurrency icon={TrendingUp}   accentColor="green"   animationDelay="0ms"   />
            <MetricCard label="Saídas Hoje"    value={summary.saidas_hoje}   isCurrency icon={TrendingDown}  accentColor="red"     animationDelay="50ms"  />
            <MetricCard label="Saldo do Dia"   value={summary.saldo_hoje}    isCurrency icon={Wallet}        accentColor={summary.saldo_hoje >= 0 ? 'gold' : 'red'} animationDelay="100ms" />
            <MetricCard label="Pedidos Hoje"   value={summary.pedidos_hoje}             icon={ShoppingBag}  accentColor="blue"    animationDelay="150ms" />
            <MetricCard label="Ticket Médio"   value={summary.ticket_medio}  isCurrency icon={ReceiptText}  accentColor="default" animationDelay="200ms" />
            <MetricCard label="Total Semana"   value={summary.total_semana}  isCurrency icon={DollarSign}   accentColor="gold"    animationDelay="250ms" />
          </div>

          {/* Chart + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-mamba-white tracking-wide">Fluxo de Caixa</h3>
                  <p className="text-xs text-mamba-silver mt-0.5">Últimos 7 dias</p>
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
              {/* Weekly breakdown */}
              <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-4">
                <h3 className="text-xs font-bold tracking-wider text-mamba-silver uppercase mb-4">Resumo Semanal</h3>
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

          {/* Recent Orders */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 animate-fade-in-up animate-delay-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Pedidos Recentes</h3>
                <p className="text-xs text-mamba-silver mt-0.5">Últimos pedidos de hoje</p>
              </div>
              <a href="/pedidos"
                className="flex items-center gap-1.5 text-xs font-semibold text-mamba-gold hover:text-mamba-gold/80 transition-colors cursor-pointer"
              >
                Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <OrdersTable pedidos={pedidosHoje} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  )
}
