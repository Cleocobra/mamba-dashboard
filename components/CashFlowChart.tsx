'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatBRL } from '@/lib/utils'
import type { CashFlowEntry } from '@/lib/types'

interface CashFlowChartProps {
  data: CashFlowEntry[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-mamba-dark border border-mamba-border rounded-xl p-3 shadow-card">
      <p className="text-xs font-bold text-mamba-silver mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-mamba-silver/80 capitalize">{entry.name}:</span>
          <span className="font-bold text-mamba-white tabular-nums">{formatBRL(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

const formatYAxis = (value: number) => {
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`
  return `R$${value}`
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-mamba-silver/40 text-sm">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFCC00" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#FFCC00" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="data"
          tick={{ fill: '#BCBCBC', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(val) => {
            const [, m, d] = val.split('-')
            return `${d}/${m}`
          }}
        />
        <YAxis
          tick={{ fill: '#BCBCBC', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatYAxis}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: '#BCBCBC' }}
          formatter={(val) => <span style={{ color: '#BCBCBC', textTransform: 'capitalize' }}>{val}</span>}
        />

        <Area
          type="monotone"
          dataKey="entradas"
          name="Entradas"
          stroke="#22C55E"
          strokeWidth={2}
          fill="url(#gradEntradas)"
          dot={false}
          activeDot={{ r: 4, fill: '#22C55E', strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="saidas"
          name="Saídas"
          stroke="#EF4444"
          strokeWidth={2}
          fill="url(#gradSaidas)"
          dot={false}
          activeDot={{ r: 4, fill: '#EF4444', strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="saldo"
          name="Saldo"
          stroke="#FFCC00"
          strokeWidth={2}
          fill="url(#gradSaldo)"
          dot={false}
          activeDot={{ r: 4, fill: '#FFCC00', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
