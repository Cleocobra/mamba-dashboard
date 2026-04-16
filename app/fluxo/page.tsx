'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Plus, Trash2,
  Calendar, ArrowUpCircle, ArrowDownCircle, Edit3, Check, X,
} from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Lancamento {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data: string
  categoria: string
}

const CATEGORIAS_ENTRADA = ['Vendas', 'Transferência', 'Investimento', 'Outros']
const CATEGORIAS_SAIDA   = ['Fornecedores', 'Marketing', 'Logística', 'Salários', 'Impostos', 'Fretes', 'Outros']

const STORAGE_KEY_LANCAMENTOS  = 'mamba_lancamentos'
const STORAGE_KEY_SALDO_INICIAL = 'mamba_saldo_inicial'
const SALDO_INICIAL_PADRAO = 2000

// ── Tooltip customizado ──────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-mamba-dark border border-mamba-border rounded-xl p-3 shadow-card">
      <p className="text-xs font-bold text-mamba-silver mb-2">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-mamba-silver/80 capitalize">{e.name}:</span>
          <span className="font-bold text-mamba-white tabular-nums">{formatBRL(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FluxoPage() {
  const [lancamentos,   setLancamentos]   = useState<Lancamento[]>([])
  const [saldoInicial,  setSaldoInicial]  = useState(SALDO_INICIAL_PADRAO)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [saldoTemp,     setSaldoTemp]     = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [form, setForm] = useState({
    tipo: 'saida' as 'entrada' | 'saida',
    descricao: '', valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria: 'Outros',
  })

  // Carrega do localStorage na inicialização
  useEffect(() => {
    try {
      const sl = localStorage.getItem(STORAGE_KEY_SALDO_INICIAL)
      if (sl !== null) setSaldoInicial(parseFloat(sl))

      const lc = localStorage.getItem(STORAGE_KEY_LANCAMENTOS)
      if (lc) setLancamentos(JSON.parse(lc))
    } catch {}
  }, [])

  // Persiste lançamentos no localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_LANCAMENTOS, JSON.stringify(lancamentos)) } catch {}
  }, [lancamentos])

  // Persiste saldo inicial no localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SALDO_INICIAL, String(saldoInicial)) } catch {}
  }, [saldoInicial])

  // ── Cálculos ────────────────────────────────────────────────
  const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const totalSaidas   = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
  const saldoAtual    = saldoInicial + totalEntradas - totalSaidas

  // ── Gráfico: saldo acumulado por dia ─────────────────────────
  const chartData = useCallback(() => {
    const dias: Record<string, { entradas: number; saidas: number }> = {}

    // Últimos 14 dias
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const chave = d.toISOString().split('T')[0]
      dias[chave] = { entradas: 0, saidas: 0 }
    }

    for (const l of lancamentos) {
      if (dias[l.data]) {
        if (l.tipo === 'entrada') dias[l.data].entradas += l.valor
        else                      dias[l.data].saidas   += l.valor
      }
    }

    let saldoCorrido = saldoInicial
    return Object.entries(dias).map(([data, v]) => {
      saldoCorrido += v.entradas - v.saidas
      const [, m, d] = data.split('-')
      return {
        label: `${d}/${m}`,
        entradas: v.entradas,
        saidas: v.saidas,
        saldo: saldoCorrido,
      }
    })
  }, [lancamentos, saldoInicial])

  // ── Handlers ────────────────────────────────────────────────
  const handleAddLancamento = () => {
    if (!form.descricao.trim() || !form.valor) return
    const novo: Lancamento = {
      id: Date.now().toString(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor),
      data: form.data,
      categoria: form.categoria,
    }
    setLancamentos(prev => [novo, ...prev])
    setForm({ tipo: 'saida', descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: 'Outros' })
    setShowForm(false)
  }

  const handleRemover = (id: string) => setLancamentos(prev => prev.filter(l => l.id !== id))

  const handleSalvarSaldo = () => {
    const v = parseFloat(saldoTemp.replace(',', '.'))
    if (!isNaN(v)) setSaldoInicial(v)
    setEditandoSaldo(false)
  }

  const dados = chartData()

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header title="Fluxo de Caixa" subtitle="Controle manual de entradas e saídas" />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* ── Métricas ────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Saldo Inicial — editável */}
            <div className="rounded-xl border border-mamba-border bg-mamba-card p-5 card-hover animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-wider text-mamba-silver uppercase">Saldo Inicial</p>
                <div className="flex items-center gap-1">
                  {editandoSaldo ? (
                    <>
                      <button onClick={handleSalvarSaldo}
                        className="p-1.5 rounded-md bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors cursor-pointer">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditandoSaldo(false)}
                        className="p-1.5 rounded-md bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setSaldoTemp(String(saldoInicial)); setEditandoSaldo(true) }}
                      className="p-1.5 rounded-md bg-mamba-border/40 text-mamba-silver hover:text-mamba-gold transition-colors cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {editandoSaldo ? (
                <input
                  type="number"
                  value={saldoTemp}
                  onChange={e => setSaldoTemp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSalvarSaldo()}
                  autoFocus
                  className="w-full text-xl font-black bg-transparent border-b-2 border-mamba-gold text-mamba-white outline-none pb-1 tabular-nums"
                />
              ) : (
                <p className="text-2xl font-black text-mamba-white tabular-nums">{formatBRL(saldoInicial)}</p>
              )}
              <p className="text-xs text-mamba-silver/50 mt-1">Clique no lápis para editar</p>
            </div>

            {/* Entradas */}
            <div className="rounded-xl border border-green-400/20 bg-mamba-card p-5 card-hover animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-wider text-mamba-silver uppercase">Total Entradas</p>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-400/10 border border-green-400/20">
                  <TrendingUp className="w-4.5 h-4.5 text-green-400" strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-black text-green-400 tabular-nums">{formatBRL(totalEntradas)}</p>
              <p className="text-xs text-mamba-silver/50 mt-1">{lancamentos.filter(l => l.tipo === 'entrada').length} lançamentos</p>
            </div>

            {/* Saídas */}
            <div className="rounded-xl border border-red-400/20 bg-mamba-card p-5 card-hover animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-wider text-mamba-silver uppercase">Total Saídas</p>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-400/10 border border-red-400/20">
                  <TrendingDown className="w-4.5 h-4.5 text-red-400" strokeWidth={2} />
                </div>
              </div>
              <p className="text-2xl font-black text-red-400 tabular-nums">{formatBRL(totalSaidas)}</p>
              <p className="text-xs text-mamba-silver/50 mt-1">{lancamentos.filter(l => l.tipo === 'saida').length} lançamentos</p>
            </div>

            {/* Saldo Atual */}
            <div className={cn(
              'rounded-xl border bg-mamba-card p-5 card-hover animate-fade-in-up',
              saldoAtual >= 0 ? 'border-mamba-gold/20' : 'border-red-400/20'
            )} style={{ animationDelay: '150ms' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-wider text-mamba-silver uppercase">Saldo Atual</p>
                <div className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg border',
                  saldoAtual >= 0 ? 'bg-mamba-gold/10 border-mamba-gold/20' : 'bg-red-400/10 border-red-400/20'
                )}>
                  <Wallet className={cn('w-4.5 h-4.5', saldoAtual >= 0 ? 'text-mamba-gold' : 'text-red-400')} strokeWidth={2} />
                </div>
              </div>
              <p className={cn('text-2xl font-black tabular-nums', saldoAtual >= 0 ? 'text-mamba-gold' : 'text-red-400')}>
                {formatBRL(saldoAtual)}
              </p>
              <p className="text-xs text-mamba-silver/50 mt-1">Inicial + Entradas − Saídas</p>
            </div>
          </div>

          {/* ── Gráfico ─────────────────────────────────────── */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Saldo Acumulado</h3>
                <p className="text-xs text-mamba-silver mt-0.5">Últimos 14 dias — baseado nos lançamentos</p>
              </div>
            </div>
            {lancamentos.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-mamba-silver/30 text-sm">
                <Calendar className="w-8 h-8 mb-2 text-mamba-border" />
                Faça lançamentos para visualizar o gráfico
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dados} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#FFFF00" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FFFF00" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#BCBCBC', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#BCBCBC', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#22C55E" strokeWidth={2} fill="url(#gradEnt)" dot={false} />
                  <Area type="monotone" dataKey="saldo"    name="Saldo"    stroke="#FFFF00" strokeWidth={2} fill="url(#gradSaldo)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Lançamentos ─────────────────────────────────── */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Lançamentos</h3>
                <p className="text-xs text-mamba-silver mt-0.5">{lancamentos.length} registro{lancamentos.length !== 1 ? 's' : ''} • salvos automaticamente</p>
              </div>
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-mamba-gold text-mamba-black rounded-lg hover:bg-mamba-gold/90 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                Novo Lançamento
              </button>
            </div>

            {/* Formulário */}
            {showForm && (
              <div className="mb-5 p-4 rounded-xl bg-mamba-dark border border-mamba-border space-y-3 animate-fade-in-up">
                {/* Tipo */}
                <div className="flex items-center gap-2">
                  {(['entrada', 'saida'] as const).map(t => (
                    <button key={t}
                      onClick={() => setForm(f => ({ ...f, tipo: t, categoria: t === 'entrada' ? 'Vendas' : 'Outros' }))}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer',
                        form.tipo === t
                          ? t === 'entrada'
                            ? 'bg-green-400/15 border-green-400/40 text-green-400'
                            : 'bg-red-400/15 border-red-400/40 text-red-400'
                          : 'border-mamba-border text-mamba-silver hover:border-mamba-silver/60'
                      )}
                    >
                      {t === 'entrada'
                        ? <ArrowUpCircle className="w-4 h-4" />
                        : <ArrowDownCircle className="w-4 h-4" />
                      }
                      {t === 'entrada' ? 'Entrada' : 'Saída'}
                    </button>
                  ))}
                </div>

                {/* Campos */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">Descrição *</label>
                    <input type="text" placeholder={form.tipo === 'entrada' ? 'Ex: Venda à vista' : 'Ex: Fornecedor XYZ'}
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">Valor (R$) *</label>
                    <input type="number" step="0.01" placeholder="0,00"
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">Data *</label>
                    <input type="date" value={form.data}
                      onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">Categoria</label>
                    <select value={form.categoria}
                      onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg cursor-pointer">
                      {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={handleAddLancamento}
                    disabled={!form.descricao.trim() || !form.valor}
                    className="px-5 py-2 text-xs font-bold bg-mamba-gold text-mamba-black rounded-lg hover:bg-mamba-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    Salvar Lançamento
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-xs font-medium text-mamba-silver border border-mamba-border rounded-lg hover:bg-mamba-dark transition-colors cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de lançamentos */}
            {lancamentos.length === 0 ? (
              <div className="text-center py-10 text-mamba-silver/30 text-sm">
                <Calendar className="w-10 h-10 mx-auto mb-3 text-mamba-border" />
                <p>Nenhum lançamento ainda.</p>
                <p className="text-xs mt-1">Clique em "Novo Lançamento" para começar.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {lancamentos.map(l => (
                  <div key={l.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-mamba-dark border border-mamba-border hover:border-mamba-border/80 transition-colors">
                    {/* Ícone */}
                    <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0',
                      l.tipo === 'entrada' ? 'bg-green-400/10' : 'bg-red-400/10')}>
                      {l.tipo === 'entrada'
                        ? <ArrowUpCircle className="w-4.5 h-4.5 text-green-400" />
                        : <ArrowDownCircle className="w-4.5 h-4.5 text-red-400" />}
                    </div>
                    {/* Descrição */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-mamba-white truncate">{l.descricao}</p>
                      <p className="text-[11px] text-mamba-silver/50">
                        {l.categoria} • {formatDate(l.data)}
                      </p>
                    </div>
                    {/* Valor */}
                    <span className={cn('text-base font-black tabular-nums flex-shrink-0',
                      l.tipo === 'entrada' ? 'text-green-400' : 'text-red-400')}>
                      {l.tipo === 'entrada' ? '+' : '−'}{formatBRL(l.valor)}
                    </span>
                    {/* Remover */}
                    <button onClick={() => handleRemover(l.id)}
                      className="text-mamba-silver/25 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0 ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Totalizador final */}
            {lancamentos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-mamba-border flex items-center justify-between">
                <span className="text-xs text-mamba-silver/60 font-medium">
                  Saldo Inicial {formatBRL(saldoInicial)} + Entradas {formatBRL(totalEntradas)} − Saídas {formatBRL(totalSaidas)}
                </span>
                <span className={cn('text-base font-black tabular-nums',
                  saldoAtual >= 0 ? 'text-mamba-gold' : 'text-red-400')}>
                  = {formatBRL(saldoAtual)}
                </span>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
