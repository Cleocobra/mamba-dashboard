'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CashFlowChart from '@/components/CashFlowChart'
import MetricCard from '@/components/MetricCard'
import {
  TrendingUp, TrendingDown, Wallet, Plus, Trash2,
  Calendar, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { formatBRL, formatDate, getLast7Days } from '@/lib/utils'
import type { CashFlowEntry } from '@/lib/types'

interface ManualEntry {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data: string
  categoria: string
}

const CATEGORIAS_ENTRADA = ['Vendas', 'Transferência', 'Investimento', 'Outros']
const CATEGORIAS_SAIDA = ['Fornecedores', 'Marketing', 'Logística', 'Salários', 'Impostos', 'Outros']

export default function FluxoPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cashflow, setCashflow] = useState<CashFlowEntry[]>([])
  const [summary, setSummary] = useState({ total_entradas: 0, total_saidas: 0, saldo_periodo: 0 })
  const [dias, setDias] = useState(7)
  const [entries, setEntries] = useState<ManualEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'saida' as 'entrada' | 'saida',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria: 'Outros',
  })

  const fetchCashflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/cashflow?dias=${dias}`)
      const data = await res.json()
      if (data.cashflow) {
        setCashflow(data.cashflow)
        setSummary(data.summary || {})
      }
    } catch (err) {
      console.error(err)
    }
  }, [dias])

  useEffect(() => {
    setIsLoading(true)
    fetchCashflow().finally(() => setIsLoading(false))
  }, [fetchCashflow])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchCashflow()
    setIsRefreshing(false)
  }

  const handleAddEntry = () => {
    if (!form.descricao || !form.valor) return
    const entry: ManualEntry = {
      id: Date.now().toString(),
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data: form.data,
      categoria: form.categoria,
    }
    setEntries((prev) => [entry, ...prev])
    setForm({ tipo: 'saida', descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: 'Outros' })
    setShowForm(false)
  }

  const total_manual_entradas = entries.filter(e => e.tipo === 'entrada').reduce((a, e) => a + e.valor, 0)
  const total_manual_saidas = entries.filter(e => e.tipo === 'saida').reduce((a, e) => a + e.valor, 0)

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        <Header
          title="Fluxo de Caixa"
          subtitle="Entradas, saídas e saldo do período"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="Total Entradas"
              value={summary.total_entradas + total_manual_entradas}
              isCurrency
              icon={TrendingUp}
              accentColor="green"
            />
            <MetricCard
              label="Total Saídas"
              value={summary.total_saidas + total_manual_saidas}
              isCurrency
              icon={TrendingDown}
              accentColor="red"
            />
            <MetricCard
              label="Saldo do Período"
              value={summary.saldo_periodo - total_manual_saidas + total_manual_entradas}
              isCurrency
              icon={Wallet}
              accentColor={summary.saldo_periodo >= 0 ? 'gold' : 'red'}
            />
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Gráfico de Fluxo</h3>
                <p className="text-xs text-mamba-silver mt-0.5">Vendas da Loja Integrada</p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-mamba-dark rounded-lg border border-mamba-border">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDias(d)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                      dias === d ? 'bg-mamba-gold text-mamba-black' : 'text-mamba-silver hover:text-mamba-white'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
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

          {/* Manual Entries */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-mamba-white">Lançamentos Manuais</h3>
                <p className="text-xs text-mamba-silver mt-0.5">Saídas e entradas avulsas</p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-mamba-gold text-mamba-black rounded-lg hover:bg-mamba-gold/90 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Lançamento
              </button>
            </div>

            {/* Form */}
            {showForm && (
              <div className="mb-4 p-4 rounded-xl bg-mamba-dark border border-mamba-border space-y-3 animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, tipo: 'entrada', categoria: 'Vendas' }))}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      form.tipo === 'entrada'
                        ? 'bg-green-400/10 border-green-400/30 text-green-400'
                        : 'border-mamba-border text-mamba-silver hover:border-mamba-silver'
                    }`}
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Entrada
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, tipo: 'saida', categoria: 'Outros' }))}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      form.tipo === 'saida'
                        ? 'bg-red-400/10 border-red-400/30 text-red-400'
                        : 'border-mamba-border text-mamba-silver hover:border-mamba-silver'
                    }`}
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" /> Saída
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">
                      Descrição
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Fornecedor X"
                      value={form.descricao}
                      onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={form.valor}
                      onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-mamba-silver uppercase tracking-wider block mb-1">
                      Categoria
                    </label>
                    <select
                      value={form.categoria}
                      onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full px-3 py-2 text-sm input-mamba rounded-lg cursor-pointer"
                    >
                      {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddEntry}
                    className="px-4 py-2 text-xs font-bold bg-mamba-gold text-mamba-black rounded-lg hover:bg-mamba-gold/90 transition-colors cursor-pointer"
                  >
                    Salvar Lançamento
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-xs font-medium text-mamba-silver border border-mamba-border rounded-lg hover:bg-mamba-dark transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Entries list */}
            {entries.length === 0 ? (
              <div className="text-center py-8 text-mamba-silver/40 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-mamba-border" />
                Nenhum lançamento manual registrado
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-mamba-dark border border-mamba-border hover:border-mamba-border/80 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                      entry.tipo === 'entrada' ? 'bg-green-400/10' : 'bg-red-400/10'
                    }`}>
                      {entry.tipo === 'entrada'
                        ? <ArrowUpCircle className="w-4 h-4 text-green-400" />
                        : <ArrowDownCircle className="w-4 h-4 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-mamba-white truncate">{entry.descricao}</p>
                      <p className="text-[11px] text-mamba-silver/60">{entry.categoria} • {formatDate(entry.data)}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                      entry.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {entry.tipo === 'entrada' ? '+' : '-'}{formatBRL(entry.valor)}
                    </span>
                    <button
                      onClick={() => setEntries(prev => prev.filter(e => e.id !== entry.id))}
                      className="text-mamba-silver/30 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
