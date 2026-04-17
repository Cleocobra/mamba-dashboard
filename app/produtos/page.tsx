'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import {
  Package, Search, ChevronDown, ChevronUp, ChevronsUpDown,
  ShoppingCart, Tag, Palette, Ruler, DollarSign,
  Calendar, TrendingUp, AlertCircle, X, BarChart2,
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

// Ordem de tamanhos
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'EG', 'G1', 'G2', 'G3', 'EGG', 'EGGGG']
function sortSize(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase())
  const ib = SIZE_ORDER.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b, 'pt-BR')
}

// ── Format helpers ─────────────────────────────────────────────────────────
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtQtd = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)

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

// ── Metric card ────────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, sub, color = 'gold', loading, onClick,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color?: 'gold' | 'green' | 'blue' | 'purple'; loading?: boolean
  onClick?: () => void
}) {
  const colors = {
    gold:   'text-mamba-gold   bg-mamba-gold/10   border-mamba-gold/20',
    green:  'text-green-400    bg-green-400/10    border-green-400/20',
    blue:   'text-blue-400     bg-blue-400/10     border-blue-400/20',
    purple: 'text-purple-400   bg-purple-400/10   border-purple-400/20',
  }
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-mamba-card border border-mamba-border rounded-xl p-4 flex items-start gap-3',
        onClick && 'cursor-pointer hover:border-mamba-gold/40 transition-colors'
      )}
    >
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
        {onClick && !loading && (
          <p className="text-[10px] text-mamba-gold/60 mt-1">Clique para ver detalhes →</p>
        )}
      </div>
    </div>
  )
}

// ── Bloco cor → tamanhos (reutilizado nos dois modais) ────────────────────
function BlocoCor({
  cor, tamanhos, barColor, idx,
}: {
  cor: string; tamanhos: Record<string, number>; barColor: string; idx: number
}) {
  const totalCor     = Object.values(tamanhos).reduce((s, v) => s + v, 0)
  const tamOrdenados = Object.entries(tamanhos).sort((a, b) => sortSize(a[0], b[0]))
  const maxQtd       = Math.max(...Object.values(tamanhos))

  return (
    <div className="bg-mamba-black/40 border border-mamba-border/60 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-purple-400" />
          <span className="text-xs font-semibold text-mamba-white">{cor}</span>
        </div>
        <span className="text-[11px] text-mamba-silver/50">{fmtQtd(totalCor)} un. total</span>
      </div>
      <div className="space-y-1.5">
        {tamOrdenados.map(([tam, qtd]) => {
          const pct = maxQtd > 0 ? (qtd / maxQtd) * 100 : 0
          return (
            <div key={tam} className="flex items-center gap-2.5">
              <span className="w-10 text-[11px] font-bold text-mamba-silver/70 text-right flex-shrink-0">{tam}</span>
              <div className="flex-1 h-5 bg-mamba-border/50 rounded-md overflow-hidden">
                <div
                  className={cn('h-full rounded-md transition-all duration-500', barColor, 'opacity-80')}
                  style={{ width: `${Math.max(pct, 6)}%` }}
                />
              </div>
              <span className="w-16 text-xs font-black text-mamba-white text-right flex-shrink-0">
                {fmtQtd(qtd)} un.
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const BAR_COLORS = [
  'bg-mamba-gold', 'bg-blue-400', 'bg-purple-400', 'bg-green-400',
  'bg-orange-400', 'bg-pink-400', 'bg-cyan-400',   'bg-red-400',
]

// ── Modal base ─────────────────────────────────────────────────────────────
function ModalBase({
  titulo, subtitulo, total, onClose, children,
}: {
  titulo: string; subtitulo?: string; total: number
  onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] bg-mamba-dark border border-mamba-border rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mamba-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-mamba-gold/10 border border-mamba-gold/20 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-mamba-gold" />
            </div>
            <div>
              <h2 className="text-sm font-black text-mamba-white">{titulo}</h2>
              <p className="text-[10px] text-mamba-silver/50">{subtitulo ?? `${fmtQtd(total)} unidades no período`}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-mamba-silver/40 hover:text-mamba-white hover:bg-mamba-border transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-mamba-border bg-mamba-black/30 flex-shrink-0">
          <span className="text-xs text-mamba-silver/50 uppercase tracking-wider font-bold">Total Geral</span>
          <span className="text-base font-black text-mamba-gold">{fmtQtd(total)} unidades</span>
        </div>
      </div>
    </div>
  )
}

// ── Modal 1: agrupado por produto → cor → tamanho ─────────────────────────
function ModalResumoPorProduto({ produtos, onClose }: { produtos: ProdutoItem[]; onClose: () => void }) {
  type GrupoCor     = Record<string, number>
  type GrupoProduto = Record<string, GrupoCor>
  type Grupos       = Record<string, GrupoProduto>

  const grupos: Grupos = {}
  let totalGeral = 0

  for (const p of produtos) {
    const nome = p.nome     || 'Produto'
    const cor  = p.cor      !== '—' ? p.cor      : 'Sem cor'
    const tam  = p.tamanho  !== '—' ? p.tamanho  : 'Único'
    if (!grupos[nome])      grupos[nome] = {}
    if (!grupos[nome][cor]) grupos[nome][cor] = {}
    grupos[nome][cor][tam] = (grupos[nome][cor][tam] || 0) + p.quantidade
    totalGeral += p.quantidade
  }

  const produtosOrdenados = Object.entries(grupos).sort((a, b) => {
    const tA = Object.values(a[1]).flatMap(c => Object.values(c)).reduce((s, v) => s + v, 0)
    const tB = Object.values(b[1]).flatMap(c => Object.values(c)).reduce((s, v) => s + v, 0)
    return tB - tA
  })

  return (
    <ModalBase titulo="Resumo de Produção" total={totalGeral} onClose={onClose}>
      {produtosOrdenados.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-mamba-silver/20 mx-auto mb-3" />
          <p className="text-sm text-mamba-silver/40">Nenhum produto no período</p>
        </div>
      ) : produtosOrdenados.map(([nome, cores], pi) => {
        const totalProd = Object.values(cores).flatMap(c => Object.values(c)).reduce((s, v) => s + v, 0)
        const coresOrdenadas = Object.entries(cores).sort((a, b) =>
          Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0)
        )
        return (
          <div key={nome} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', BAR_COLORS[pi % BAR_COLORS.length])} />
                <h3 className="text-sm font-bold text-mamba-white leading-snug">{nome}</h3>
              </div>
              <span className="text-xs font-black text-mamba-gold bg-mamba-gold/10 border border-mamba-gold/20 px-2.5 py-0.5 rounded-lg">{fmtQtd(totalProd)} un.</span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-mamba-border ml-1">
              {coresOrdenadas.map(([cor, tamanhos], ci) => (
                <BlocoCor key={cor} cor={cor} tamanhos={tamanhos} barColor={BAR_COLORS[pi % BAR_COLORS.length]} idx={ci} />
              ))}
            </div>
          </div>
        )
      })}
    </ModalBase>
  )
}

// ── Modal 2: agrupado APENAS por cor → tamanho (sem nome do produto) ───────
function ModalResumoAgrupado({ produtos, onClose }: { produtos: ProdutoItem[]; onClose: () => void }) {
  type GrupoCor = Record<string, number>
  const grupos: Record<string, GrupoCor> = {}
  let totalGeral = 0

  for (const p of produtos) {
    const cor = p.cor     !== '—' ? p.cor     : 'Sem cor'
    const tam = p.tamanho !== '—' ? p.tamanho : 'Único'
    if (!grupos[cor]) grupos[cor] = {}
    grupos[cor][tam] = (grupos[cor][tam] || 0) + p.quantidade
    totalGeral += p.quantidade
  }

  const coresOrdenadas = Object.entries(grupos).sort((a, b) =>
    Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0)
  )

  return (
    <ModalBase titulo="Total por Cor e Tamanho" subtitulo="Todas as camisetas agrupadas" total={totalGeral} onClose={onClose}>
      {coresOrdenadas.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-mamba-silver/20 mx-auto mb-3" />
          <p className="text-sm text-mamba-silver/40">Nenhum produto no período</p>
        </div>
      ) : coresOrdenadas.map(([cor, tamanhos], i) => (
        <BlocoCor key={cor} cor={cor} tamanhos={tamanhos} barColor={BAR_COLORS[i % BAR_COLORS.length]} idx={i} />
      ))}
    </ModalBase>
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
  const [showModal,       setShowModal]       = useState(false)
  const [showModalAgrup,  setShowModalAgrup]  = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchProdutos = useCallback(async (p: Periodo, di: string, df: string) => {
    if (p === 'personalizado' && (!di || !df)) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ periodo: p })
      if (p === 'personalizado') { params.set('data_inicio', di); params.set('data_fim', df) }
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

  useEffect(() => { fetchProdutos(periodo, dataInicio, dataFim) }, [fetchProdutos, periodo, dataInicio, dataFim])

  // Close modal on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setShowModalAgrup(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

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
      const va = a[sortKey]; const vb = b[sortKey]
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul
      return String(va).localeCompare(String(vb), 'pt-BR') * mul
    })

  const topProduto = produtos[0]
  const totalUnidades = meta?.total_unidades ?? 0

  const periodoLabels: Record<Periodo, string> = {
    hoje: 'Hoje', semana: 'Últimos 7 dias', mes: 'Últimos 30 dias', personalizado: 'Personalizado',
  }

  const cols: { key: SortKey; label: string; icon: React.ElementType; align?: string }[] = [
    { key: 'nome',       label: 'Produto',  icon: Package                         },
    { key: 'tipo',       label: 'Tipo',     icon: Tag                             },
    { key: 'cor',        label: 'Cor',      icon: Palette                         },
    { key: 'tamanho',    label: 'Tamanho',  icon: Ruler                           },
    { key: 'quantidade', label: 'Qtd',      icon: ShoppingCart, align: 'text-right'},
    { key: 'receita',    label: 'Receita',  icon: DollarSign,   align: 'text-right'},
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

          {/* Period selector */}
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
            {periodo === 'personalizado' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-mamba rounded-lg px-3 py-1.5 text-xs" />
                <span className="text-mamba-silver/40 text-xs">até</span>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-mamba rounded-lg px-3 py-1.5 text-xs" />
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Metric cards — o de Unidades abre o modal */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={ShoppingCart}
              label="Unidades Vendidas"
              value={loading ? '—' : fmtQtd(totalUnidades)}
              sub={loading ? '' : `${meta?.pedidos_analisados ?? 0} pedidos`}
              color="gold"
              loading={loading}
              onClick={!loading && totalUnidades > 0 ? () => setShowModalAgrup(true) : undefined}
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

          {/* Botões Resumo */}
          {!loading && totalUnidades > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão 1: por produto */}
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-3 py-3 px-4 bg-mamba-card border border-mamba-gold/30 hover:border-mamba-gold hover:bg-mamba-gold/5 rounded-xl text-sm font-bold text-mamba-gold transition-all duration-200 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-mamba-gold/10 border border-mamba-gold/20 flex items-center justify-center flex-shrink-0 group-hover:bg-mamba-gold/20 transition-colors">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-black">Por Produto</p>
                  <p className="text-[10px] text-mamba-gold/60 font-normal">Agrupado por modelo</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-50 flex-shrink-0" />
              </button>

              {/* Botão 2: total agrupado (sem nome do produto) */}
              <button
                onClick={() => setShowModalAgrup(true)}
                className="flex items-center gap-3 py-3 px-4 bg-mamba-card border border-purple-400/30 hover:border-purple-400 hover:bg-purple-400/5 rounded-xl text-sm font-bold text-purple-300 transition-all duration-200 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-400/20 transition-colors">
                  <Palette className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-black">Total por Cor e Tam.</p>
                  <p className="text-[10px] text-purple-300/60 font-normal">Todas juntas, sem modelo</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-50 flex-shrink-0" />
              </button>
            </div>
          )}

          {/* Table section */}
          <div className="bg-mamba-card border border-mamba-border rounded-xl overflow-hidden">
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
                      <tr key={`${p.sku}-${i}`} className="hover:bg-mamba-black/30 transition-colors">
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
                        <td className="px-4 py-3">
                          {p.tipo !== '—' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20 whitespace-nowrap">{p.tipo}</span>
                          ) : <span className="text-xs text-mamba-silver/30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {p.cor !== '—' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-400/10 text-purple-300 border border-purple-400/20 whitespace-nowrap">
                              <Palette className="w-2.5 h-2.5" />{p.cor}
                            </span>
                          ) : <span className="text-xs text-mamba-silver/30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {p.tamanho !== '—' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-mamba-border text-mamba-white border border-mamba-border/80 whitespace-nowrap">{p.tamanho}</span>
                          ) : <span className="text-xs text-mamba-silver/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-xs font-bold',
                            p.quantidade >= 10 ? 'bg-mamba-gold/20 text-mamba-gold border border-mamba-gold/30' : 'text-mamba-white'
                          )}>
                            {fmtQtd(p.quantidade)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold text-green-400 whitespace-nowrap">{fmtBRL(p.receita)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

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

          {!loading && meta && (
            <p className="text-[11px] text-mamba-silver/30 text-center pb-2">
              Dados de {new Date(meta.inicio).toLocaleDateString('pt-BR')} até {new Date(meta.fim).toLocaleDateString('pt-BR')}
              {' '}· Pedidos cancelados excluídos da contagem
            </p>
          )}
        </main>
      </div>

      {/* Modal 1: por produto */}
      {showModal      && <ModalResumoPorProduto produtos={produtos} onClose={() => setShowModal(false)} />}
      {/* Modal 2: total agrupado */}
      {showModalAgrup && <ModalResumoAgrupado   produtos={produtos} onClose={() => setShowModalAgrup(false)} />}
    </div>
  )
}
