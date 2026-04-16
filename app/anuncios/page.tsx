'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  Megaphone, DollarSign, Eye, MousePointer,
  TrendingUp, Zap, RefreshCw, ShoppingCart,
} from 'lucide-react'
import { formatBRL, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

const PRESETS = [
  { label: 'Hoje',    value: 'today'    },
  { label: 'Ontem',  value: 'yesterday' },
  { label: '7 dias', value: 'last_7d'  },
  { label: '30 dias',value: 'last_30d' },
]

const CONTAS = [
  { label: 'Todas',       value: 'todas'       },
  { label: 'Mamba 2025',  value: 'Mamba 2025'  },
  { label: 'Mamba Army',  value: 'Mamba Army'  },
]

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-mamba-dark border border-mamba-border rounded-xl p-3 shadow-card">
      <p className="text-xs font-bold text-mamba-silver mb-1">{label}</p>
      <p className="text-sm font-bold text-blue-400">{formatBRL(payload[0]?.value || 0)}</p>
    </div>
  )
}

export default function AnunciosPage() {
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [data,         setData]         = useState<any>(null)
  const [connected,    setConnected]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [preset,       setPreset]       = useState('last_7d')
  const [contaAtiva,   setContaAtiva]   = useState('todas')

  const fetchMeta = async (p = preset) => {
    try {
      setError(null)
      const res  = await fetch(`/api/meta?preset=${p}`)
      const json = await res.json()
      setConnected(json.connected || false)
      if (json.connected) setData(json.data)
      else setError(json.error || 'Erro desconhecido')
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetchMeta().finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!isLoading) {
      setIsRefreshing(true)
      fetchMeta(preset).finally(() => setIsRefreshing(false))
    }
  }, [preset])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchMeta()
    setIsRefreshing(false)
  }

  // Filtra campanhas pelo nome da conta selecionada
  const campanhasFiltradas = (data?.campaigns || []).filter((c: any) => {
    if (contaAtiva === 'todas') return true
    return c.account_name === contaAtiva
  })

  // Totais filtrados
  const totalGasto         = campanhasFiltradas.reduce((s: number, c: any) => s + c.spend, 0)
  const totalImpressoes    = campanhasFiltradas.reduce((s: number, c: any) => s + c.impressions, 0)
  const totalCliques       = campanhasFiltradas.reduce((s: number, c: any) => s + c.clicks, 0)
  const totalPurchases     = campanhasFiltradas.reduce((s: number, c: any) => s + (c.purchases || 0), 0)
  const totalPurchaseValue = campanhasFiltradas.reduce((s: number, c: any) => s + (c.purchase_value || 0), 0)
  const cpcMedio           = totalCliques > 0 ? totalGasto / totalCliques : 0
  const cpmMedio           = totalImpressoes > 0 ? (totalGasto / totalImpressoes) * 1000 : 0
  const roasMedio = (() => {
    const com = campanhasFiltradas.filter((c: any) => c.roas > 0)
    return com.length > 0 ? com.reduce((s: number, c: any) => s + c.roas, 0) / com.length : 0
  })()

  const metricas = [
    { label: 'Gasto Total',    value: formatBRL(totalGasto),            icon: DollarSign,   color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20'   },
    { label: 'Impressões',     value: formatNumber(totalImpressoes),    icon: Eye,          color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
    { label: 'Cliques',        value: formatNumber(totalCliques),       icon: MousePointer, color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/20'   },
    { label: 'Conversões',     value: formatNumber(totalPurchases),     icon: ShoppingCart, color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20'  },
    { label: 'Receita',        value: formatBRL(totalPurchaseValue),    icon: TrendingUp,   color: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/20'},
    { label: 'CPC Médio',      value: formatBRL(cpcMedio),              icon: Megaphone,    color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
    { label: 'CPM Médio',      value: formatBRL(cpmMedio),              icon: Megaphone,    color: 'text-pink-400',   bg: 'bg-pink-400/10',   border: 'border-pink-400/20'   },
    { label: 'ROAS',           value: roasMedio > 0 ? `${roasMedio.toFixed(2)}x` : '—', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  ]

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header
          title="Meta Ads"
          subtitle={connected ? 'Mamba 2025 + Mamba Army — dados em tempo real' : 'Carregando...'}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Período + Conta */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-mamba-card rounded-lg border border-mamba-border">
              {PRESETS.map(p => (
                <button key={p.value} onClick={() => setPreset(p.value)}
                  className={cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer',
                    preset === p.value ? 'bg-mamba-gold text-mamba-black' : 'text-mamba-silver hover:text-mamba-white')}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-mamba-card rounded-lg border border-mamba-border">
              {CONTAS.map(c => (
                <button key={c.value} onClick={() => setContaAtiva(c.value)}
                  className={cn('px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer',
                    contaAtiva === c.value ? 'bg-blue-600 text-white' : 'text-mamba-silver hover:text-mamba-white')}>
                  {c.label}
                </button>
              ))}
            </div>

            {isRefreshing && <RefreshCw className="w-4 h-4 text-mamba-silver/50 animate-spin" />}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-mamba-gold/30 border-t-mamba-gold rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          ) : !connected ? (
            <div className="p-8 rounded-xl border border-dashed border-mamba-border/60 text-center text-mamba-silver/40">
              Não conectado
            </div>
          ) : (
            <>
              {/* Cards por conta */}
              {data?.contas && (
                <div className="grid grid-cols-2 gap-4">
                  {data.contas.map((conta: any, i: number) => (
                    <div key={i} className={cn('p-4 rounded-xl border bg-mamba-card', i === 0 ? 'border-blue-500/20' : 'border-purple-500/20')}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn('text-xs font-bold tracking-wider uppercase', i === 0 ? 'text-blue-400' : 'text-purple-400')}>
                          {conta.name}
                        </span>
                        <span className="text-[10px] text-mamba-silver/50">{conta.campaigns} campanhas</span>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <div>
                          <p className="text-[10px] text-mamba-silver/50 mb-0.5">Gasto</p>
                          <p className="text-sm font-black tabular-nums text-mamba-white">{formatBRL(conta.spend)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-mamba-silver/50 mb-0.5">Impressões</p>
                          <p className="text-sm font-black tabular-nums text-mamba-white">{formatNumber(conta.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-mamba-silver/50 mb-0.5">Cliques</p>
                          <p className="text-sm font-black tabular-nums text-mamba-white">{formatNumber(conta.clicks)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-mamba-silver/50 mb-0.5">Conversões</p>
                          <p className="text-sm font-black tabular-nums text-green-400">{formatNumber(conta.purchases || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-mamba-silver/50 mb-0.5">Receita</p>
                          <p className="text-sm font-black tabular-nums text-emerald-400">{formatBRL(conta.purchase_value || 0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Métricas consolidadas */}
              <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
                {metricas.map(m => {
                  const Icon = m.icon
                  return (
                    <div key={m.label} className={cn('p-4 rounded-xl bg-mamba-card border', m.border)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg', m.bg)}>
                          <Icon className={cn('w-3.5 h-3.5', m.color)} />
                        </div>
                        <span className="text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider leading-tight">{m.label}</span>
                      </div>
                      <p className="text-lg font-black text-mamba-white tabular-nums">{m.value}</p>
                    </div>
                  )
                })}
              </div>

              {/* Gráfico gasto diário */}
              {data?.daily_spend?.length > 0 && (
                <div className="p-5 rounded-xl bg-mamba-card border border-mamba-border">
                  <h4 className="text-xs font-bold tracking-wider text-mamba-silver uppercase mb-4">Gasto Diário — Ambas as Contas</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.daily_spend} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                      <XAxis dataKey="data" tick={{ fill: '#BCBCBC', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v.split('-').slice(1).join('/')} />
                      <YAxis tick={{ fill: '#BCBCBC', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `R$${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="gasto" radius={[4, 4, 0, 0]}>
                        {data.daily_spend.map((_: any, i: number) => (
                          <Cell key={i} fill={i === data.daily_spend.length - 1 ? '#FFFF00' : '#3B82F6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tabela de campanhas */}
              <div className="overflow-x-auto rounded-xl border border-mamba-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mamba-border bg-mamba-card">
                      {['Campanha', 'Conta', 'Gasto', 'Impressões', 'Cliques', 'Conversões', 'Receita', 'CPC', 'ROAS'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campanhasFiltradas.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-mamba-silver/40 text-sm">Nenhuma campanha no período</td></tr>
                    ) : campanhasFiltradas.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-mamba-border/60 hover:bg-mamba-card/50 transition-colors">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-mamba-white text-xs font-medium truncate">{c.campaign_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md',
                            c.account_name === 'Mamba 2025' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400')}>
                            {c.account_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black tabular-nums text-mamba-white">{formatBRL(c.spend)}</td>
                        <td className="px-4 py-3 tabular-nums text-mamba-silver">{formatNumber(c.impressions)}</td>
                        <td className="px-4 py-3 tabular-nums text-mamba-silver">{formatNumber(c.clicks)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-green-400">
                          {c.purchases > 0 ? formatNumber(c.purchases) : <span className="text-mamba-silver/30">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-bold text-emerald-400">
                          {c.purchase_value > 0 ? formatBRL(c.purchase_value) : <span className="text-mamba-silver/30">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-orange-400 font-semibold">{formatBRL(c.cpc)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold">
                          {c.roas > 0
                            ? <span className="text-yellow-400">{c.roas.toFixed(2)}x</span>
                            : <span className="text-mamba-silver/30">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {campanhasFiltradas.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-mamba-border bg-mamba-card/50">
                        <td className="px-4 py-3 text-xs font-bold text-mamba-silver uppercase tracking-wider" colSpan={2}>
                          Total ({campanhasFiltradas.length} campanhas)
                        </td>
                        <td className="px-4 py-3 font-black tabular-nums text-mamba-gold">{formatBRL(totalGasto)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-mamba-white">{formatNumber(totalImpressoes)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-mamba-white">{formatNumber(totalCliques)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-green-400">{formatNumber(totalPurchases)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-emerald-400">{formatBRL(totalPurchaseValue)}</td>
                        <td className="px-4 py-3 tabular-nums font-bold text-orange-400">{formatBRL(cpcMedio)}</td>
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
