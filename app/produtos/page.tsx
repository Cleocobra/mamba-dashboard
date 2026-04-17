'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import {
  Package, Search, ChevronDown, ChevronUp, ChevronsUpDown,
  ShoppingCart, Tag, Palette, Ruler, DollarSign, RefreshCw,
  Calendar, TrendingUp, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
interface ProdutoItem {
  nome:       string
  tipo:       string
  cor:        string
  tamanho:    string
  quantidade: number
  receita:    number
  sku:        string
}

interface Meta {
  total_unidades:     number
  total_receita:      number
  pedidos_analisados: number
  skus_unicos:        number
  periodo:            string
  inicio:             string
  fim:                string
}

type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado'
type SortKey = 'nome' | 'tipo' | 'cor' | 'tamanho' | 'quantidade' | 'receita'
type SortDir = 'asc' | 'desc'

// ── Format helpers ─────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtQtd(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-mamba-border rounded', className)} />
}

// ── Sort icon ──────────────────────────────────────────────────────────────
function SortIcon({ col, current, dir }: { col: SortKey; current: SortKey; dir: SortDir }) {
  if (col !== current) return <ChevronsUpDown className="w-3 h-3 text-mamba-silver/30" />
  return dir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-mamba-gold" />
    : <ChevronDown className="w-3 h-3 text-mamba-gold" />
}

// ── Summary card ───────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, sub, color = 'gold', loading,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color?: 'gold' | 'green' | 'blue' | 'purple'; loading?: boolean
}) {
  const colors = {
    gold:   'text-mamba-gold   bg-mamba-gold/10   border-mamba-gold/20',
    green:  'text-green-400    bg-green-400/10    border-green-400/20',
    blue:   'text-blue-400     bg-blue-400/10     border-blue-400/20',
    purple: 'text-purple-400   bg-purple-400/10   border-purple-400/20',
  }
  return (
    <div className="bg-mamba-card border border-mamba-border rounded-xl p-4 flex items-start gap-3">
      <div className={cn('p-2 rounded-lg border flex-shrink-0', colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-mamba-silver/60 uppercase tracking-wider truncate">{label}</p>
        {loading ? (
          <Skeleton className="h-6 w-24 mt-1" />
        ) : (
          <p className="text-xl font-black text-mamba-white mt-0.5 truncate">{value}</p>
        )}
        {sub && !loading && <p className="text-[10px] text-mamba-silver/40 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProdutosPage() {
  const [periodo,    setPeriodo]    = useState<Periodo>('semana')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim,    setDataFim]    = useState('')
  const [produtos,   setProdutos]   = useState<ProdutoItem[]>([])
  const [meta,       setMeta]       = useState<Meta | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [busca,      setBusca]      = useState('')
  const [sortKey,    setSortKey]    = useState<SortKey>('quantidade')
  const [sortDir,    setSortDir]    = useState<SortDir>('desc')
  const abortRef = useRef<AbortController | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchProdutos = useCallback(async (p: Periodo, di: string, df: string) => {
    if (p === 'personalizado' && (!di || !df)) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ periodo: p })
      if (p === 'personalizado') {
        params.set('data_inicio', di)
        params.set('data_fim',    df)
      }
      const res  = await fetch(`/api/produtos?${params}`, { signal: ctrl.signal })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar dados')
      setProdutos(data.produtos || [])
      setMeta(data.meta || null)
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProdutos(periodo, dataInicio, dataFim)
  }, [fetchProdutos, periodo, dataInicio, dataFim])

  // ── Sort ───────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ── Filter + Sort ──────────────────────────────────────────────────────
  const filtered = produtos
    .filter(p => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return (
        p.nome.toLowerCase().includes(q)    ||
        p.cor.toLowerCase().includes(q)     ||
        p.tipo.toLowerCase().includes(q)    ||
        p.tamanho.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul
      return String(va).localeCompare(String(vb), 'pt-BR') * mul
    })

  const topProduto = produtos[0]

  const periodoLabels: Record<Periodo, string> = {
    hoje:         'Hoje',
    semana:       'Últimos 7 dias',
    mes:          'Últimos 30 dias',
    personalizado:'Personalizado',
  }

  // ── Header columns ─────────────────────────────────────────────────────
  const cols: { key: SortKey; label: string; icon: React.ElementType; align?: string }[] = [
    { key: 'nome',        label: 'Produto',   icon: Package         },
    { key: 'tipo',        label: 'Tipo',      icon: Tag             },
    { key: 'cor',         label: 'Cor',       icon: Palette         },
    { key: 'tamanho',     label: 'Tamanho',   icon: Ruler           },
    { key: 'quantidade',  label: 'Qtd',       icon: ShoppingCart, align: 'text-right' },
    { key: 'receita',     label: 'Receita',   icon: DollarSign,   align: 'text-right' },
  ]

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <Header
          title="Produtos Vendidos"
          subtitle={meta ? `${meta.pedidos_analisados} pedidos analisados` : undefined}
          onRefresh={() => fetchProdutos(periodo, dataInicio, dataFim)}
          isRefreshing={loading}
        />

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 space-y-5">

          {/* ── Period selector ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex bg-mamba-card border border-mamba-border rounded-xl p-1 gap-1 flex-wrap">
              {(['hoje', 'semana', 'mes', 'personalizado'] as Periodo[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
                    periodo === p
                      ? 'bg-mamba-gold text-mamba-black'
                      : 'text-mamba-silver hover:text-mamba-white hover:bg-mamba-border'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {periodoLabels[p]}
                </button>
              ))}
            </div>

            {/* Custom date pickers */}
            {periodo === 'personalizado' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="input-mamba rounded-lg px-3 py-1.5 text-xs"
                />
                <span className="text-mamba-silver/40 text-xs">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="input-mamba rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Metric cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={ShoppingCart}
              label="Unidades Vendidas"
              value={loading ? '—' : fmtQtd(meta?.total_unidades ?? 0)}
              sub={loading ? '' : `${meta?.pedidos_analisados ?? 0} pedidos`}
              color="gold"
              loading={loading}
            />
            <MetricCard
              icon={Tag}
              label="SKUs Únicos"
              value={loading ? '—' : String(meta?.skus_unicos ?? 0)}
              sub="variações diferentes"
              color="blue"
              loading={loading}
            />
            <MetricCard
              icon={DollarSign}
              label="Receita Total"
              value={loading ? '—' : fmtBRL(meta?.total_receita ?? 0)}
              color="green"
              loading={loading}
            />
            <MetricCard
              icon={TrendingUp}
              label="Mais Vendido"
              value={loading || !topProduto ? '—' : `${fmtQtd(topProduto.quantidade)} un.`}
              sub={topProduto?.nome}
              color="purple"
              loading={loading}
            />
          </div>

          {/* ── Table section ── */}
          <div className="bg-mamba-card border border-mamba-border rounded-xl overflow-hidden">

            {/* Table header / search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-mamba-border">
              <div>
                <h2 className="text-sm font-bold text-mamba-white">Detalhamento por SKU</h2>
                <p className="text-[11px] text-mamba-silver/50 mt-0.5">
                  {loading ? 'Carregando...' : `${filtered.length} variação${filtered.length !== 1 ? 'ões' : ''} encontrada${filtered.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mamba-silver/40" />
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar produto, cor, tamanho..."
                  className="w-full input-mamba rounded-lg pl-9 pr-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mamba-border bg-mamba-black/30">
                    {cols.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={cn(
                          'px-4 py-3 text-left text-[10px] font-bold tracking-wider text-mamba-silver/50 uppercase cursor-pointer hover:text-mamba-silver transition-colors select-none whitespace-nowrap',
                          col.align
                        )}
                      >
                        <div className={cn('flex items-center gap-1.5', col.align === 'text-right' && 'justify-end')}>
                          <col.icon className="w-3 h-3" />
                          {col.label}
                          <SortIcon col={col.key} current={sortKey} dir={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-mamba-border">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <Package className="w-10 h-10 text-mamba-silver/20 mx-auto mb-3" />
                        <p className="text-sm text-mamba-silver/40">
                          {busca ? 'Nenhum produto encontrado para essa busca' : 'Nenhum produto vendido neste período'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, i) => (
                      <tr
                        key={`${p.sku}-${i}`}
                        className="hover:bg-mamba-black/30 transition-colors group"
                      >
                        {/* Produto */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5 max-w-xs">
                            <div className="w-7 h-7 rounded-lg bg-mamba-gold/10 border border-mamba-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Package className="w-3.5 h-3.5 text-mamba-gold" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-mamba-white leading-snug line-clamp-2">{p.nome}</p>
                              <p className="text-[10px] text-mamba-silver/40 font-mono mt-0.5 truncate">{p.sku}</p>
                            </div>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-3">
                          {p.tipo !== '—' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20 whitespace-nowrap">
                              {p.tipo}
                            </span>
                          ) : (
                            <span className="text-xs text-mamba-silver/30">—</span>
                          )}
                        </td>

                        {/* Cor */}
                        <td className="px-4 py-3">
                          {p.cor !== '—' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-400/10 text-purple-300 border border-purple-400/20 whitespace-nowrap">
                              <Palette className="w-2.5 h-2.5" />
                              {p.cor}
                            </span>
                          ) : (
                            <span className="text-xs text-mamba-silver/30">—</span>
                          )}
                        </td>

                        {/* Tamanho */}
                        <td className="px-4 py-3">
                          {p.tamanho !== '—' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-mamba-border text-mamba-white border border-mamba-border/80 whitespace-nowrap">
                              {p.tamanho}
                            </span>
                          ) : (
                            <span className="text-xs text-mamba-silver/30">—</span>
                          )}
                        </td>

                        {/* Quantidade */}
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-xs font-bold',
                            p.quantidade >= 10
                              ? 'bg-mamba-gold/20 text-mamba-gold border border-mamba-gold/30'
                              : 'text-mamba-white'
                          )}>
                            {fmtQtd(p.quantidade)}
                          </span>
                        </td>

                        {/* Receita */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold text-green-400 whitespace-nowrap">
                            {fmtBRL(p.receita)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Totals footer */}
                {!loading && filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-mamba-gold/20 bg-mamba-gold/5">
                      <td colSpan={4} className="px-4 py-3 text-xs font-bold text-mamba-silver/60 uppercase tracking-wider">
                        Total ({filtered.length} SKU{filtered.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black text-mamba-gold">
                          {fmtQtd(filtered.reduce((s, p) => s + p.quantidade, 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black text-green-400">
                          {fmtBRL(filtered.reduce((s, p) => s + p.receita, 0))}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Info footer */}
          {!loading && meta && (
            <p className="text-[11px] text-mamba-silver/30 text-center pb-2">
              Dados de {new Date(meta.inicio).toLocaleDateString('pt-BR')} até {new Date(meta.fim).toLocaleDateString('pt-BR')}
              {' '}· Pedidos cancelados excluídos da contagem
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
