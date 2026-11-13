'use client'
import { useState } from 'react'
import { Link as LinkIcon, RefreshCw } from 'lucide-react'

// Campo "Inserir matéria por link" do painel: cria uma pauta manual no plantão de hoje
// e mostra o link de aprovação (o mesmo que chega no WhatsApp).
export default function PautaForm() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; link?: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/pauta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      setMsg({ kind: 'ok', text: `Pronta para aprovação: “${j.titulo}”. O card também foi para o seu WhatsApp.`, link: j.aprovar })
      setUrl('')
    } catch (err: any) {
      setMsg({ kind: 'err', text: err.message })
    } finally { setBusy(false) }
  }

  return (
    <section className="sa-panel" aria-labelledby="pauta-titulo">
      <div className="sa-panel-heading"><div><p className="sa-kicker">Pauta manual</p><h2 id="pauta-titulo">Inserir matéria por link</h2></div></div>
      <p className="sa-section-description">Cole o link de uma matéria de qualquer veículo. Ela vira um post avulso no plantão de hoje e segue para a sua aprovação.</p>
      <form onSubmit={submit} className="sa-field">
        <label htmlFor="pauta-url">Link da matéria</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="pauta-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" disabled={busy} style={{ flex: 1, minWidth: 240 }} />
          <button type="submit" disabled={busy || !url.trim()} className="sa-button sa-button-dark">
            {busy ? <RefreshCw className="sa-spinning" /> : <LinkIcon />} {busy ? 'Preparando…' : 'Criar post'}
          </button>
        </div>
      </form>
      {busy && <p role="status" className="sa-working"><RefreshCw className="sa-spinning" />Lendo a matéria, escrevendo o resumo e gerando o card (1 a 2 minutos)…</p>}
      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} className={`sa-notice ${msg.kind === 'ok' ? 'sa-notice-success' : 'sa-notice-error'}`}>
        <p>{msg.text}{msg.link && <> <a href={msg.link} target="_blank" rel="noreferrer">Abrir aprovação</a></>}</p>
      </div>}
    </section>
  )
}
