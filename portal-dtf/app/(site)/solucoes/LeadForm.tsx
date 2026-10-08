'use client'

import { useState } from 'react'
import { INTERESTS, INTEREST_LABEL } from '@/lib/types'

const input = 'w-full rounded-lg border border-white/15 bg-ui-dark px-3 py-2 text-sm text-ui-white outline-none focus:border-ui-accent'

export function LeadForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending'); setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`)
      setState('ok')
    } catch (err: any) { setError(err.message); setState('err') }
  }

  if (state === 'ok') return <p className="self-center rounded-xl border border-green-400/30 bg-green-400/10 p-5 text-sm text-green-300">Recebido! Entramos em contato em breve.</p>

  return (
    <form onSubmit={submit} className="space-y-3">
      <input name="nome" required minLength={2} maxLength={80} placeholder="Seu nome" className={input} />
      <input name="contato" required minLength={6} maxLength={120} placeholder="WhatsApp ou e-mail" className={input} />
      <input name="empresa" maxLength={120} placeholder="Estamparia (opcional)" className={input} />
      <select name="interesse" defaultValue="encaixe" className={input}>
        {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABEL[i]}</option>)}
      </select>
      <textarea name="mensagem" maxLength={1000} rows={3} placeholder="Quantos metros por mês, que máquina usa… (opcional)" className={input} />
      {/* honeypot: escondido de pessoas */}
      <input name="site" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state === 'err' && <p className="text-xs text-red-300">{error}</p>}
      <button disabled={state === 'sending'} className="w-full rounded-xl bg-ui-accent px-5 py-3 text-sm font-black text-ui-black hover:bg-ui-accent-dim disabled:opacity-50">
        {state === 'sending' ? 'Enviando…' : 'Quero conhecer'}
      </button>
    </form>
  )
}
