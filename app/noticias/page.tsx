'use client'

import { useCallback, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { cn, formatDate } from '@/lib/utils'
import { CheckCircle2, XCircle, Send, Sparkles, RotateCcw, ExternalLink, AlertTriangle, Save } from 'lucide-react'
import type { Edition, EditionStatus } from '@/lib/scemalta/types'

interface Config { instagram: boolean; anthropic: boolean; brave: boolean; autoPublish: boolean }

const STATUS: Record<EditionStatus, { label: string; cls: string }> = {
  draft:     { label: 'Rascunho',  cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  approved:  { label: 'Aprovada',  cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  rejected:  { label: 'Rejeitada', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
  published: { label: 'Publicada', cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  error:     { label: 'Erro',      cls: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
}

const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export default function NoticiasPage() {
  const [editions,  setEditions]  = useState<Edition[]>([])
  const [config,    setConfig]    = useState<Config | null>(null)
  const [selected,  setSelected]  = useState<string | null>(null)
  const [busy,      setBusy]      = useState<string | null>(null)
  const [msg,       setMsg]       = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [manchete,  setManchete]  = useState('')
  const [legenda,   setLegenda]   = useState('')

  const load = useCallback(async () => {
    const res  = await fetch('/api/scemalta/editions')
    const json = await res.json()
    setEditions(json.editions || [])
    setConfig(json.config || null)
    setSelected(prev => prev ?? json.editions?.[0]?.date ?? null)
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const current = editions.find(e => e.date === selected) || null
  useEffect(() => { setManchete(current?.manchete ?? ''); setLegenda(current?.legenda ?? '') }, [current?.date, current?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (label: string, url: string, init?: RequestInit) => {
    setBusy(label); setMsg(null)
    try {
      const res  = await fetch(url, { method: 'POST', ...init })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      setMsg({ kind: 'ok', text: json.skipped ? `Nada feito: ${json.skipped}.` : `${label}: concluído.` })
      await load()
      if (json.edition?.date) setSelected(json.edition.date)
    } catch (err: any) {
      setMsg({ kind: 'err', text: `${label}: ${err.message}` })
      await load()
    } finally { setBusy(null) }
  }

  const patch = (date: string, body: Partial<Edition>, label: string) =>
    call(label, `/api/scemalta/editions/${date}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const cards = current ? Math.max(current.cardCount, 1 + current.noticias.length + (current.oportunidades.length ? 1 : 0)) : 0
  const editable = current && current.status !== 'published'

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Header title="SC em Alta" subtitle="Edição diária: gerar, revisar e publicar no site e no Instagram" onRefresh={load} isRefreshing={busy !== null} />

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 space-y-5">

          {config && (!config.anthropic || !config.instagram) && (
            <div className="flex items-start gap-3 rounded-xl border border-orange-400/20 bg-orange-400/10 p-4 text-xs text-orange-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {!config.anthropic && <p>ANTHROPIC_API_KEY não configurada: a geração da edição não vai funcionar.</p>}
                {!config.instagram && <p>IG_USER_ID / IG_ACCESS_TOKEN não configurados: a publicação vai só para o site.</p>}
                {!config.brave && <p>BRAVE_API_KEY ausente: a coleta usa apenas os feeds RSS.</p>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => call('Gerar edição de hoje', '/api/scemalta/run')} disabled={busy !== null}
              className={cn(btn, 'bg-mamba-gold text-mamba-black border-mamba-gold hover:bg-mamba-gold-dim')}>
              <Sparkles className="w-3.5 h-3.5" /> Gerar edição de hoje
            </button>
            {current && current.status !== 'published' && (
              <button onClick={() => call('Regenerar', `/api/scemalta/run?date=${current.date}&force=1`)} disabled={busy !== null}
                className={cn(btn, 'bg-mamba-card text-mamba-silver border-mamba-border hover:text-mamba-white')}>
                <RotateCcw className="w-3.5 h-3.5" /> Regenerar {formatDate(current.date)}
              </button>
            )}
            {config && (
              <span className="text-[11px] text-mamba-silver/60 ml-auto">
                {config.autoPublish ? 'Cron publica às 8h, exceto edições rejeitadas.' : 'Cron só publica edições aprovadas.'}
              </span>
            )}
          </div>

          {msg && (
            <div className={cn('rounded-xl border p-3 text-xs', msg.kind === 'ok' ? 'border-green-400/20 bg-green-400/10 text-green-300' : 'border-red-400/20 bg-red-400/10 text-red-300')}>
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
            {/* Lista de edições */}
            <div className="bg-mamba-card border border-mamba-border rounded-xl overflow-hidden">
              <p className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase border-b border-mamba-border">Edições</p>
              {loading ? <p className="p-4 text-xs text-mamba-silver">Carregando...</p>
              : editions.length === 0 ? <p className="p-4 text-xs text-mamba-silver">Nenhuma edição ainda. Clique em “Gerar edição de hoje”.</p>
              : editions.map(e => (
                <button key={e.date} onClick={() => setSelected(e.date)}
                  className={cn('w-full text-left px-4 py-3 border-b border-mamba-border/60 hover:bg-mamba-dark transition-colors cursor-pointer', selected === e.date && 'bg-mamba-dark')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-mamba-white">{formatDate(e.date)}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', STATUS[e.status].cls)}>{STATUS[e.status].label}</span>
                  </div>
                  <p className="mt-1 text-xs text-mamba-silver truncate">{e.manchete || e.error || '—'}</p>
                </button>
              ))}
            </div>

            {/* Detalhe */}
            <div className="space-y-5">
              {!current ? (
                <div className="bg-mamba-card border border-mamba-border rounded-xl p-8 text-center text-sm text-mamba-silver">Selecione uma edição.</div>
              ) : (
                <>
                  <div className="bg-mamba-card border border-mamba-border rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', STATUS[current.status].cls)}>{STATUS[current.status].label}</span>
                      <span className="text-xs text-mamba-silver">{current.rawCount} itens coletados · {current.noticias.length} notícias · {current.oportunidades.length} oportunidades · {cards} cards</span>
                      {current.instagram?.permalink && (
                        <a href={current.instagram.permalink} target="_blank" rel="noreferrer" className="text-xs font-bold text-green-400 inline-flex items-center gap-1 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Post no Instagram
                        </a>
                      )}
                      {current.status === 'published' && (
                        <a href={`/scemalta/${current.date}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-mamba-gold inline-flex items-center gap-1 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Ver no site
                        </a>
                      )}
                    </div>

                    {current.error && <p className="text-xs text-orange-300 bg-orange-400/10 border border-orange-400/20 rounded-lg p-3">{current.error}</p>}

                    {current.noticias.length > 0 && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase">Manchete</label>
                          <input value={manchete} onChange={e => setManchete(e.target.value)} disabled={!editable} maxLength={80}
                            className="w-full bg-mamba-dark border border-mamba-border rounded-lg px-3 py-2 text-sm text-mamba-white disabled:opacity-60" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase">Legenda do Instagram</label>
                          <textarea value={legenda} onChange={e => setLegenda(e.target.value)} disabled={!editable} rows={7}
                            className="w-full bg-mamba-dark border border-mamba-border rounded-lg px-3 py-2 text-sm text-mamba-white disabled:opacity-60 font-sans" />
                          <p className="text-[11px] text-mamba-silver/60">{current.hashtags.map(h => `#${h}`).join(' ')}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {editable && (
                            <button onClick={() => patch(current.date, { manchete, legenda }, 'Salvar textos')} disabled={busy !== null}
                              className={cn(btn, 'bg-mamba-card text-mamba-silver border-mamba-border hover:text-mamba-white')}>
                              <Save className="w-3.5 h-3.5" /> Salvar textos
                            </button>
                          )}
                          {editable && current.status !== 'approved' && (
                            <button onClick={() => patch(current.date, { status: 'approved' }, 'Aprovar')} disabled={busy !== null}
                              className={cn(btn, 'bg-blue-400/10 text-blue-400 border-blue-400/20 hover:bg-blue-400/20')}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                            </button>
                          )}
                          {editable && current.status !== 'rejected' && (
                            <button onClick={() => patch(current.date, { status: 'rejected' }, 'Rejeitar')} disabled={busy !== null}
                              className={cn(btn, 'bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20')}>
                              <XCircle className="w-3.5 h-3.5" /> Rejeitar
                            </button>
                          )}
                          {editable && (
                            <button onClick={() => { if (confirm(`Publicar a edição de ${formatDate(current.date)} no site${config?.instagram ? ' e no Instagram' : ''} agora?`)) call('Publicar', `/api/scemalta/publish?date=${current.date}`) }}
                              disabled={busy !== null}
                              className={cn(btn, 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20')}>
                              <Send className="w-3.5 h-3.5" /> Publicar agora
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {current.noticias.length > 0 && (
                    <div className="bg-mamba-card border border-mamba-border rounded-xl p-5 space-y-3">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase">Cards do carrossel</p>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {Array.from({ length: cards }, (_, n) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={n} src={`/api/scemalta/img/${current.date}/${n}.jpg?v=${encodeURIComponent(current.updatedAt)}`} alt={`Card ${n}`}
                            className="w-44 shrink-0 rounded-lg border border-mamba-border" loading="lazy" />
                        ))}
                      </div>
                    </div>
                  )}

                  {current.noticias.length > 0 && (
                    <div className="bg-mamba-card border border-mamba-border rounded-xl p-5 space-y-4">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase">Notícias</p>
                      {current.noticias.map((n, i) => (
                        <div key={i} className="border-b border-mamba-border/60 pb-3 last:border-0 last:pb-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-mamba-gold">{i + 1} · {n.categoria}</p>
                          <p className="text-sm font-bold text-mamba-white mt-1">{n.titulo}</p>
                          <p className="text-xs text-mamba-silver mt-1">{n.resumo}</p>
                          <a href={n.link} target="_blank" rel="noreferrer" className="text-[11px] text-mamba-silver/60 hover:text-mamba-gold">{n.fonte} ↗</a>
                        </div>
                      ))}
                      {current.oportunidades.length > 0 && (
                        <>
                          <p className="text-[10px] font-bold tracking-[0.2em] text-green-400/70 uppercase pt-2">Oportunidades</p>
                          {current.oportunidades.map((o, i) => (
                            <div key={i} className="border-b border-mamba-border/60 pb-3 last:border-0 last:pb-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">{o.tipo}</p>
                              <p className="text-sm font-bold text-mamba-white mt-1">{o.titulo}</p>
                              <p className="text-xs text-mamba-silver mt-1">{o.descricao}</p>
                              <a href={o.link} target="_blank" rel="noreferrer" className="text-[11px] text-mamba-silver/60 hover:text-green-400">{o.fonte} ↗</a>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
