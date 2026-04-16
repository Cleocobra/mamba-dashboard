'use client'

import { formatBRL, formatNumber } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Megaphone, TrendingUp, MousePointer, Eye, DollarSign, Zap, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetaAdsPanelProps {
  connected?: boolean
  data?: {
    total_spend: number
    total_impressions: number
    total_clicks: number
    avg_cpc: number
    avg_cpm: number
    roas?: number
    campaigns: Array<{
      id: string
      name: string
      status: string
      spend: number
      impressions: number
      clicks: number
      cpc: number
      roas?: number
    }>
    daily_spend?: Array<{ data: string; gasto: number }>
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-mamba-dark border border-mamba-border rounded-xl p-3 shadow-card">
      <p className="text-xs font-bold text-mamba-silver mb-2">{label}</p>
      <p className="text-sm font-bold text-blue-400">{formatBRL(payload[0]?.value || 0)}</p>
    </div>
  )
}

export default function MetaAdsPanel({ connected = false, data }: MetaAdsPanelProps) {
  if (!connected || !data) {
    return (
      <div className="rounded-xl border border-dashed border-mamba-border/60 bg-mamba-card/30 p-10 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto mb-4">
          <Megaphone className="w-7 h-7 text-blue-400" />
        </div>
        <h3 className="text-base font-bold text-mamba-white mb-2">Conectar Meta Ads</h3>
        <p className="text-sm text-mamba-silver/60 mb-6 max-w-sm mx-auto">
          Conecte sua conta de anúncios do Meta para acompanhar gastos, impressões, cliques e ROAS em tempo real.
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
          {[
            { label: 'Gasto total', icon: DollarSign },
            { label: 'Impressões', icon: Eye },
            { label: 'Cliques', icon: MousePointer },
            { label: 'ROAS', icon: TrendingUp },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-mamba-dark border border-mamba-border">
              <Icon className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-mamba-silver">{label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors duration-200 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            Gerar Token de Acesso Meta
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <p className="text-[11px] text-mamba-silver/40">
            Configure META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no .env
          </p>
        </div>
      </div>
    )
  }

  const metrics = [
    { label: 'Gasto Total', value: formatBRL(data.total_spend), icon: DollarSign, color: 'text-blue-400' },
    { label: 'Impressões', value: formatNumber(data.total_impressions), icon: Eye, color: 'text-purple-400' },
    { label: 'Cliques', value: formatNumber(data.total_clicks), icon: MousePointer, color: 'text-cyan-400' },
    { label: 'CPC Médio', value: formatBRL(data.avg_cpc), icon: TrendingUp, color: 'text-orange-400' },
    { label: 'CPM Médio', value: formatBRL(data.avg_cpm), icon: Megaphone, color: 'text-pink-400' },
    { label: 'ROAS', value: data.roas ? `${data.roas.toFixed(2)}x` : '—', icon: Zap, color: 'text-green-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="p-4 rounded-xl bg-mamba-card border border-mamba-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-3.5 h-3.5', m.color)} />
                <span className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider">{m.label}</span>
              </div>
              <p className="text-xl font-black text-mamba-white tabular-nums">{m.value}</p>
            </div>
          )
        })}
      </div>

      {/* Daily Spend Chart */}
      {data.daily_spend && data.daily_spend.length > 0 && (
        <div className="p-4 rounded-xl bg-mamba-card border border-mamba-border">
          <h4 className="text-xs font-bold tracking-wider text-mamba-silver uppercase mb-4">Gasto Diário</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.daily_spend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis
                dataKey="data"
                tick={{ fill: '#BCBCBC', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => val.split('-').slice(1).join('/')}
              />
              <YAxis tick={{ fill: '#BCBCBC', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gasto" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaigns Table */}
      {data.campaigns.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-mamba-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mamba-border bg-mamba-card">
                {['Campanha', 'Status', 'Gasto', 'Impressões', 'Cliques', 'CPC'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className="border-b border-mamba-border/60 hover:bg-mamba-card/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-mamba-white text-sm font-medium">{c.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                      c.status === 'ACTIVE'
                        ? 'text-green-400 bg-green-400/10 border-green-400/20'
                        : 'text-mamba-silver bg-mamba-border/40 border-mamba-border'
                    )}>
                      {c.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums text-blue-400">{formatBRL(c.spend)}</td>
                  <td className="px-4 py-3 tabular-nums text-mamba-silver">{formatNumber(c.impressions)}</td>
                  <td className="px-4 py-3 tabular-nums text-mamba-silver">{formatNumber(c.clicks)}</td>
                  <td className="px-4 py-3 tabular-nums text-orange-400 font-semibold">{formatBRL(c.cpc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
