'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn, formatDate } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Send, Sparkles, ExternalLink, AlertTriangle, Save, RefreshCw, Trash2, Plus, Wand2, ListTodo, FileText, Users,
} from 'lucide-react'
import {
  CATEGORIES, CATEGORY_INFO, INTEREST_LABEL, LEVEL_LABEL,
  type Article, type ArticleStatus, type Category, type Lead, type Step, type Topic,
} from '@/lib/types'

interface Config { brand: string; instagram: boolean; anthropic: boolean; autoPublish: boolean; perRun: number }
type Tab = 'artigos' | 'pautas' | 'interessados'

const STATUS: Record<ArticleStatus, { label: string; cls: string }> = {
  draft:     { label: 'Rascunho',  cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  approved:  { label: 'Aprovado',  cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  rejected:  { label: 'Rejeitado', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
  published: { label: 'Publicado', cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  error:     { label: 'Erro',      cls: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
}

const btn   = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const field = 'w-full bg-ui-dark border border-ui-border rounded-lg px-3 py-2 text-sm text-ui-white'
const label = 'text-[10px] font-bold tracking-[0.2em] text-ui-silver/50 uppercase'

export default function AdminPage() {
  const [tab,      setTab]      = useState<Tab>('artigos')
  const [articles, setArticles] = useState<Article[]>([])
  const [topics,   setTopics]   = useState<Topic[]>([])
  const [leads,    setLeads]    = useState<Lead[]>([])
  const [config,   setConfig]   = useState<Config | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy,     setBusy]     = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [loading,  setLoading]  = useState(true)

  // Edição do tutorial selecionado
  const [titulo,  setTitulo]  = useState('')
  const [resumo,  setResumo]  = useState('')
  const [legenda, setLegenda] = useState('')
  const [passos,  setPassos]  = useState<Step[]>([])

  // Nova pauta
  const [nTitulo, setNTitulo] = useState('')
  const [nCat,    setNCat]    = useState<Category | ''>('')
  const [nKw,     setNKw]     = useState('')
  const [nNotas,  setNNotas]  = useState('')
  const [nPrio,   setNPrio]   = useState(5)

  const load = useCallback(async () => {
    const [a, t, l] = await Promise.all([
      fetch('/api/articles').then(r => r.json()),
      fetch('/api/topics').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
    ])
    setArticles(a.articles || [])
    setConfig(a.config || null)
    setTopics(t.topics || [])
    setLeads(l.leads || [])
    setSelected(prev => prev ?? a.articles?.[0]?.slug ?? null)
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const current = articles.find(a => a.slug === selected) || null
  useEffect(() => {
    setTitulo(current?.titulo ?? ''); setResumo(current?.resumo ?? ''); setLegenda(current?.legenda ?? ''); setPassos(current?.passos ?? [])
  }, [current?.slug, current?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (name: string, url: string, init?: RequestInit) => {
    setBusy(name); setMsg(null)
    try {
      const res  = await fetch(url, { method: 'POST', ...init })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      const extra = json.skipped ? `Nada feito: ${json.skipped}.`
        : json.added ? `${json.added.length} pauta(s) adicionada(s).`
        : json.published ? `${json.published.length} publicado(s), ${json.skipped?.length ?? 0} pulado(s).`
        : `${name}: concluído.`
      setMsg({ kind: 'ok', text: extra })
      await load()
      if (json.article?.slug) { setSelected(json.article.slug); setTab('artigos') }
      return json
    } catch (err: any) {
      setMsg({ kind: 'err', text: `${name}: ${err.message}` })
      await load()
    } finally { setBusy(null) }
  }
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const patch = (slug: string, body: Partial<Article>, name: string) => call(name, `/api/articles/${slug}`, json('PATCH', body))

  const pending = topics.filter(t => !t.usedBy).sort((a, b) => b.prioridade - a.prioridade || a.createdAt.localeCompare(b.createdAt))
  const used    = topics.filter(t => t.usedBy)
  const editable = current && current.status !== 'published'

  return (
    <div className="min-h-screen bg-ui-black">
      <div className="max-w-6xl mx-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 py-3.5 bg-ui-black/80 backdrop-blur-md border-b border-ui-border">
          <span className="flex h-8 items-center justify-center rounded-lg bg-ui-accent px-2 text-xs font-black text-ui-black">DTF</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-black tracking-tight text-ui-white truncate">{config?.brand ?? 'Portal'} · Painel</h1>
            <p className="text-xs text-ui-silver mt-0.5 truncate">Pautas → tutoriais com IA → revisão → site e Instagram</p>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className="hidden sm:inline text-xs font-bold text-ui-accent hover:underline">Ver site ↗</a>
          <button onClick={load} disabled={busy !== null}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 text-xs font-medium text-ui-silver hover:text-ui-white bg-ui-card hover:bg-ui-border border border-ui-border rounded-lg transition-all cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${busy !== null ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </header>

        <main className="px-4 py-4 md:px-6 md:py-6 space-y-5">
          {config && (!config.anthropic || !config.instagram) && (
            <div className="flex items-start gap-3 rounded-xl border border-orange-400/20 bg-orange-400/10 p-4 text-xs text-orange-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {!config.anthropic && <p>ANTHROPIC_API_KEY não configurada: a geração de tutoriais e pautas não vai funcionar.</p>}
                {!config.instagram && <p>IG_USER_ID / IG_ACCESS_TOKEN não configurados: a publicação vai só para o site.</p>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {([['artigos', 'Tutoriais', FileText, articles.length], ['pautas', 'Pautas', ListTodo, pending.length], ['interessados', 'Interessados', Users, leads.length]] as const).map(([k, l, Icon, n]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn(btn, tab === k ? 'bg-ui-accent text-ui-black border-ui-accent' : 'bg-ui-card text-ui-silver border-ui-border hover:text-ui-white')}>
                <Icon className="w-3.5 h-3.5" /> {l} <span className="opacity-60">({n})</span>
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => call('Gerar tutorial', '/api/run')} disabled={busy !== null}
                className={cn(btn, 'bg-ui-accent/10 text-ui-accent border-ui-accent/30 hover:bg-ui-accent/20')}>
                <Sparkles className="w-3.5 h-3.5" /> Gerar tutorial da próxima pauta
              </button>
            </div>
          </div>

          {config && (
            <p className="text-[11px] text-ui-silver/60">
              Agendador: gera {config.perRun} tutorial(is) por dia e {config.autoPublish ? 'publica tudo que não foi rejeitado.' : 'só publica o que foi aprovado.'}
              {' '}Quando a fila de pautas acaba, a IA sugere novas sozinha.
            </p>
          )}

          {msg && (
            <div className={cn('rounded-xl border p-3 text-xs', msg.kind === 'ok' ? 'border-green-400/20 bg-green-400/10 text-green-300' : 'border-red-400/20 bg-red-400/10 text-red-300')}>
              {msg.text}
            </div>
          )}

          {busy && <p className="text-xs text-ui-silver animate-pulse">{busy}… (a IA pode levar 1 a 3 minutos)</p>}

          {/* ── Tutoriais ─────────────────────────────────────────────── */}
          {tab === 'artigos' && (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
              <div className="bg-ui-card border border-ui-border rounded-xl overflow-hidden h-fit">
                <p className={cn(label, 'px-4 py-3 border-b border-ui-border')}>Tutoriais</p>
                {loading ? <p className="p-4 text-xs text-ui-silver">Carregando...</p>
                : articles.length === 0 ? <p className="p-4 text-xs text-ui-silver">Nenhum tutorial ainda. Adicione pautas ou clique em “Gerar tutorial”.</p>
                : articles.map(a => (
                  <button key={a.slug} onClick={() => setSelected(a.slug)}
                    className={cn('w-full text-left px-4 py-3 border-b border-ui-border/60 hover:bg-ui-dark transition-colors cursor-pointer', selected === a.slug && 'bg-ui-dark')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-ui-silver">{formatDate(a.publishedAt || a.createdAt)}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', STATUS[a.status].cls)}>{STATUS[a.status].label}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-ui-white line-clamp-2">{a.titulo}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-5 min-w-0">
                {!current ? (
                  <div className="bg-ui-card border border-ui-border rounded-xl p-8 text-center text-sm text-ui-silver">Selecione um tutorial.</div>
                ) : (
                  <>
                    <div className="bg-ui-card border border-ui-border rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', STATUS[current.status].cls)}>{STATUS[current.status].label}</span>
                        <span className="text-xs text-ui-silver">{CATEGORY_INFO[current.categoria]?.label} · {LEVEL_LABEL[current.nivel]} · {current.passos.length} passos · {current.tempoMin} min</span>
                        {current.instagram?.permalink && (
                          <a href={current.instagram.permalink} target="_blank" rel="noreferrer" className="text-xs font-bold text-green-400 inline-flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> Instagram
                          </a>
                        )}
                        {current.status === 'published' && (
                          <a href={`/tutoriais/${current.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-ui-accent inline-flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> Ver no site
                          </a>
                        )}
                      </div>

                      {current.error && <p className="text-xs text-orange-300 bg-orange-400/10 border border-orange-400/20 rounded-lg p-3">{current.error}</p>}

                      <div className="space-y-2">
                        <label className={label}>Título</label>
                        <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={90} className={field} />
                      </div>
                      <div className="space-y-2">
                        <label className={label}>Resumo (meta description)</label>
                        <textarea value={resumo} onChange={e => setResumo(e.target.value)} maxLength={170} rows={2} className={field} />
                      </div>
                      <div className="space-y-2">
                        <label className={label}>Passo a passo (confira temperaturas e tempos!)</label>
                        {passos.map((p, i) => (
                          <div key={i} className="space-y-1.5 rounded-lg border border-ui-border/60 p-3">
                            <input value={p.titulo} onChange={e => setPassos(ps => ps.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))}
                              className={cn(field, 'font-bold')} />
                            <textarea value={p.texto} rows={3} onChange={e => setPassos(ps => ps.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                              className={field} />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <label className={label}>Legenda do Instagram</label>
                        <textarea value={legenda} onChange={e => setLegenda(e.target.value)} rows={6} className={field} />
                        <p className="text-[11px] text-ui-silver/60">{current.hashtags.map(h => `#${h}`).join(' ')}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => patch(current.slug, { titulo, resumo, legenda, passos }, 'Salvar')} disabled={busy !== null}
                          className={cn(btn, 'bg-ui-card text-ui-silver border-ui-border hover:text-ui-white')}>
                          <Save className="w-3.5 h-3.5" /> Salvar textos
                        </button>
                        {editable && current.status !== 'approved' && (
                          <button onClick={() => patch(current.slug, { status: 'approved' }, 'Aprovar')} disabled={busy !== null}
                            className={cn(btn, 'bg-blue-400/10 text-blue-400 border-blue-400/20 hover:bg-blue-400/20')}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                          </button>
                        )}
                        {editable && current.status !== 'rejected' && (
                          <button onClick={() => patch(current.slug, { status: 'rejected' }, 'Rejeitar')} disabled={busy !== null}
                            className={cn(btn, 'bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20')}>
                            <XCircle className="w-3.5 h-3.5" /> Rejeitar
                          </button>
                        )}
                        {editable && (
                          <button onClick={() => { if (confirm(`Publicar "${current.titulo}" no site${config?.instagram ? ' e no Instagram' : ''} agora?`)) call('Publicar', `/api/publish?slug=${current.slug}`) }}
                            disabled={busy !== null} className={cn(btn, 'bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20')}>
                            <Send className="w-3.5 h-3.5" /> Publicar agora
                          </button>
                        )}
                        {editable && (
                          <button onClick={() => { if (confirm('Apagar este rascunho?')) call('Apagar', `/api/articles/${current.slug}`, { method: 'DELETE' }).then(() => setSelected(null)) }}
                            disabled={busy !== null} className={cn(btn, 'ml-auto bg-ui-card text-ui-silver/60 border-ui-border hover:text-red-400')}>
                            <Trash2 className="w-3.5 h-3.5" /> Apagar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-ui-card border border-ui-border rounded-xl p-5 space-y-3">
                      <p className={label}>Cards do carrossel</p>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {Array.from({ length: current.cardCount }, (_, n) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={n} src={`/api/img/${current.slug}/${n}.jpg?v=${encodeURIComponent(current.updatedAt)}`} alt={`Card ${n}`}
                            className="w-44 shrink-0 rounded-lg border border-ui-border" loading="lazy" />
                        ))}
                      </div>
                    </div>

                    <div className="bg-ui-card border border-ui-border rounded-xl p-5 space-y-3 text-xs text-ui-silver">
                      <p className={label}>Restante do conteúdo (somente leitura)</p>
                      <p><b className="text-ui-white">Introdução:</b> {current.introducao}</p>
                      {current.materiais.length > 0 && <p><b className="text-ui-white">Materiais:</b> {current.materiais.join(' · ')}</p>}
                      {current.dicas.length > 0 && <div><b className="text-ui-white">Dicas:</b><ul className="list-disc pl-5">{current.dicas.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                      {current.problemas.length > 0 && <div><b className="text-ui-white">Problemas:</b><ul className="list-disc pl-5">{current.problemas.map((p, i) => <li key={i}><b>{p.problema}</b> — {p.solucao}</li>)}</ul></div>}
                      {current.faq.length > 0 && <div><b className="text-ui-white">FAQ:</b><ul className="list-disc pl-5">{current.faq.map((f, i) => <li key={i}><b>{f.pergunta}</b> {f.resposta}</li>)}</ul></div>}
                      <p><b className="text-ui-white">Conclusão:</b> {current.conclusao}</p>
                      <p className="text-ui-silver/50">Modelo: {current.model ?? '—'} · slug: {current.slug}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Pautas ────────────────────────────────────────────────── */}
          {tab === 'pautas' && (
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
              <div className="bg-ui-card border border-ui-border rounded-xl p-5 space-y-3 h-fit">
                <p className={label}>Nova pauta</p>
                <input value={nTitulo} onChange={e => setNTitulo(e.target.value)} placeholder="Ex.: Como prensar DTF em poliamida" className={field} />
                <select value={nCat} onChange={e => setNCat(e.target.value as Category | '')} className={field}>
                  <option value="">Categoria: a IA escolhe</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_INFO[c].label}</option>)}
                </select>
                <input value={nKw} onChange={e => setNKw(e.target.value)} placeholder="Palavra-chave (opcional)" className={field} />
                <textarea value={nNotas} onChange={e => setNNotas(e.target.value)} rows={4}
                  placeholder="Suas notas: parâmetros que você testou, erros que já viu, ângulo do conteúdo. A IA usa isso com prioridade." className={field} />
                <label className="flex items-center gap-3 text-xs text-ui-silver">
                  Prioridade <input type="range" min={1} max={10} value={nPrio} onChange={e => setNPrio(Number(e.target.value))} className="flex-1" /> <b className="text-ui-white w-5">{nPrio}</b>
                </label>
                <button disabled={busy !== null || nTitulo.trim().length < 5}
                  onClick={async () => {
                    const r = await call('Adicionar pauta', '/api/topics', json('POST', { items: [{ titulo: nTitulo, categoria: nCat || undefined, palavraChave: nKw, notas: nNotas, prioridade: nPrio }] }))
                    if (r) { setNTitulo(''); setNKw(''); setNNotas(''); setNPrio(5); setNCat('') }
                  }}
                  className={cn(btn, 'w-full justify-center bg-ui-accent text-ui-black border-ui-accent hover:bg-ui-accent-dim')}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar à fila
                </button>
                <button onClick={() => call('Sugerir pautas', '/api/topics', json('POST', { suggest: 10 }))} disabled={busy !== null}
                  className={cn(btn, 'w-full justify-center bg-ui-card text-ui-silver border-ui-border hover:text-ui-white')}>
                  <Wand2 className="w-3.5 h-3.5" /> Pedir 10 pautas à IA
                </button>
              </div>

              <div className="space-y-5 min-w-0">
                <div className="bg-ui-card border border-ui-border rounded-xl overflow-hidden">
                  <p className={cn(label, 'px-4 py-3 border-b border-ui-border')}>Fila ({pending.length}) — sai primeiro a de maior prioridade</p>
                  {pending.length === 0 ? <p className="p-4 text-xs text-ui-silver">Fila vazia. O agendador pede pautas à IA sozinho, ou adicione as suas.</p>
                  : pending.map(t => (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-3 border-b border-ui-border/60">
                      <select value={t.prioridade} onChange={e => call('Prioridade', '/api/topics', json('PATCH', { id: t.id, prioridade: Number(e.target.value) }))}
                        className="bg-ui-dark border border-ui-border rounded px-1.5 py-1 text-xs text-ui-white" title="Prioridade">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ui-white">{t.titulo}</p>
                        <p className="text-[11px] text-ui-silver mt-0.5">
                          {t.categoria ? CATEGORY_INFO[t.categoria].label : 'sem categoria'}{t.palavraChave ? ` · “${t.palavraChave}”` : ''} · {t.origem === 'ia' ? 'sugerida pela IA' : 'manual'}
                          {t.notas ? ' · com notas' : ''}
                        </p>
                      </div>
                      <button onClick={() => call('Gerar tutorial', `/api/run?topic=${t.id}`)} disabled={busy !== null} title="Gerar agora"
                        className={cn(btn, 'px-2 bg-ui-accent/10 text-ui-accent border-ui-accent/30')}><Sparkles className="w-3.5 h-3.5" /></button>
                      <button onClick={() => call('Remover pauta', `/api/topics?id=${t.id}`, { method: 'DELETE' })} disabled={busy !== null} title="Remover"
                        className={cn(btn, 'px-2 bg-ui-card text-ui-silver/60 border-ui-border hover:text-red-400')}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>

                {used.length > 0 && (
                  <div className="bg-ui-card border border-ui-border rounded-xl overflow-hidden">
                    <p className={cn(label, 'px-4 py-3 border-b border-ui-border')}>Já viraram tutorial ({used.length})</p>
                    {used.map(t => (
                      <button key={t.id} onClick={() => { setSelected(t.usedBy!); setTab('artigos') }}
                        className="w-full text-left px-4 py-2.5 border-b border-ui-border/60 text-xs text-ui-silver hover:text-ui-white cursor-pointer">
                        {t.titulo} → <span className="text-ui-accent">{t.usedBy}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Interessados ──────────────────────────────────────────── */}
          {tab === 'interessados' && (
            <div className="bg-ui-card border border-ui-border rounded-xl overflow-hidden">
              <p className={cn(label, 'px-4 py-3 border-b border-ui-border')}>Interessados nas soluções (formulário de /solucoes)</p>
              {leads.length === 0 ? <p className="p-4 text-xs text-ui-silver">Ninguém ainda.</p>
              : leads.map(l => (
                <div key={l.id} className="px-4 py-3 border-b border-ui-border/60 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-ui-white">{l.nome}</b>
                    <span className="text-ui-accent">{l.contato}</span>
                    {l.empresa && <span className="text-ui-silver">· {l.empresa}</span>}
                    <span className="ml-auto text-[11px] text-ui-silver">{formatDate(l.createdAt)}</span>
                  </div>
                  <p className="text-xs text-ui-silver mt-1">{INTEREST_LABEL[l.interesse]}{l.mensagem ? ` — ${l.mensagem}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
