'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OrdersTable from '@/components/OrdersTable'
import MetricCard from '@/components/MetricCard'
import { ShoppingBag, DollarSign, TrendingUp, Filter, Search, ChevronDown } from 'lucide-react'
import { formatBRL } from '@/lib/utils'
import { getPedidosPorPeriodo, type PedidoNorm } from '@/lib/li-client'

const PERIODOS = [
  { label: 'Hoje',    value: 'hoje'  },
  { label: 'Ontem',  value: 'ontem' },
  { label: '7 dias', value: '7d'    },
  { label: '30 dias',value: '30d'   },
]

const STATUS_OPTIONS = [
  { label: 'Todos',     value: '' },
  { label: 'Aprovado',  value: 'aprovado'  },
  { label: 'Pendente',  value: 'pendente'  },
  { label: 'Enviado',   value: 'enviado'   },
  { label: 'Entregue',  value: 'entregue'  },
  { label: 'Cancelado', value: 'cancelado' },
]

export default function PedidosPage() {
  const [isLoading, setIsLoading]       = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pedidos, setPedidos]           = useState<PedidoNorm[]>([])
  const [filtrados, setFiltrados]       = useState<PedidoNorm[]>([])
  const [periodo, setPeriodo]           = useState('hoje')
  const [status, setStatus]             = useState('')
  const [search, setSearch]             = useState('')
  const [meta, setMeta]                 = useState({ total_pedidos: 0, total_valor: 0 })
  const [error, setError]               = useState<string | null>(null)

  const fetchPedidos = useCallback(async () => {
    try {
      setError(null)
      const data = await getPedidosPorPeriodo(periodo)
      setPedidos(data.pedidos)
      setMeta({ total_pedidos: data.total_pedidos, total_valor: data.total_valor })
    } catch (err: any) {
      setError('Falha ao carregar pedidos: ' + err.message)
    }
  }, [periodo])

  useEffect(() => {
    setIsLoading(true)
    fetchPedidos().finally(() => setIsLoading(false))
  }, [fetchPedidos])

  // Filtro de busca e status client-side
  useEffect(() => {
    let lista = pedidos
    if (status) lista = lista.filter(p => p.status.toLowerCase().includes(status))
    if (search.trim()) {
      const q = search.toLowerCase()
      lista = lista.filter(p => p.numero.includes(q) || p.cliente.toLowerCase().includes(q))
    }
    setFiltrados(lista)
  }, [pedidos, status, search])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchPedidos()
    setIsRefreshing(false)
  }

  const ticketMedio = meta.total_pedidos > 0 ? meta.total_valor / meta.total_pedidos : 0

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header
          title="Pedidos"
          subtitle={`${meta.total_pedidos} pedidos • ${formatBRL(meta.total_valor)} em vendas`}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Total de Pedidos" value={meta.total_pedidos} icon={ShoppingBag} accentColor="gold" />
            <MetricCard label="Receita Total"    value={meta.total_valor}   isCurrency icon={DollarSign} accentColor="green" />
            <MetricCard label="Ticket Médio"     value={ticketMedio}        isCurrency icon={TrendingUp} accentColor="blue" />
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mamba-silver/50" />
                <input
                  type="text"
                  placeholder="Buscar por número ou cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm input-mamba rounded-lg"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-mamba-dark rounded-lg border border-mamba-border">
                {PERIODOS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriodo(p.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                      periodo === p.value ? 'bg-mamba-gold text-mamba-black' : 'text-mamba-silver hover:text-mamba-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-xs font-medium input-mamba rounded-lg cursor-pointer"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mamba-silver/60 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-mamba-silver/60">
                <Filter className="w-3.5 h-3.5" />
                {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <OrdersTable pedidos={filtrados} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  )
}
