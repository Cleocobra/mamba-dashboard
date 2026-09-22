// Orquestração do SC em Alta: gerar a edição do dia, renderizar os cards,
// publicar no site e no Instagram. Também concentra a autorização das rotas.

import type { NextRequest } from 'next/server'
import { collect } from './sources'
import { editDay } from './editor'
import { cardCountFor, renderCard } from './render'
import { instagramConfigured, publishToInstagram } from './instagram'
import { getEdition, saveEdition, saveImage } from './store'
import type { Edition } from './types'

// ── Datas ──────────────────────────────────────────────────────────────────
export function todaySP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
}

export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

// ── URLs públicas ──────────────────────────────────────────────────────────
export function publicBaseUrl(): string {
  const base = process.env.SCEMALTA_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return base.replace(/\/$/, '')
}

export const imageUrl = (date: string, n: number) => `${publicBaseUrl()}/api/img/${date}/${n}.jpg`

export function buildCaption(e: Edition): string {
  const tags = e.hashtags.map(h => `#${h}`).join(' ')
  return tags ? `${e.legenda}\n\n${tags}` : e.legenda
}

// ── Autorização das rotas: Bearer CRON_SECRET (agendador) ou login básico do painel ─
// O middleware já bloqueia quem não tem credencial; aqui só distinguimos quem chamou.
export type Caller = 'cron' | 'user' | null

export async function authorize(req: NextRequest): Promise<Caller> {
  const auth   = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (secret && auth === `Bearer ${secret}`) return 'cron'
  const user = process.env.ADMIN_USER || 'admin'
  const pass = process.env.ADMIN_PASSWORD
  if (pass && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
    const i = decoded.indexOf(':')
    if (i > 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) return 'user'
  }
  return null
}

// ── Geração da edição ──────────────────────────────────────────────────────
export async function generateEdition(opts: { date?: string; force?: boolean } = {}): Promise<Edition> {
  const date = opts.date ?? todaySP()
  const existing = await getEdition(date)
  if (existing && !opts.force && existing.status !== 'error') return existing
  if (existing?.status === 'published' && opts.force) throw new Error(`A edição ${date} já foi publicada; não é possível regenerar.`)

  const now = new Date().toISOString()
  const base: Edition = {
    date, status: 'draft', createdAt: existing?.createdAt ?? now, updatedAt: now,
    manchete: '', noticias: [], oportunidades: [], legenda: '', hashtags: [], rawCount: 0, cardCount: 0,
  }

  try {
    const { items, stats } = await collect()
    base.rawCount = items.length
    if (items.length < 3) {
      const detail = stats.map(s => `${s.source}: ${s.error ? 'erro (' + s.error + ')' : s.count}`).join('; ')
      throw new Error(`Coleta insuficiente (${items.length} itens). Fontes: ${detail}`)
    }
    const ed = await editDay(date, items)
    Object.assign(base, {
      manchete: ed.manchete, noticias: ed.noticias, oportunidades: ed.oportunidades,
      legenda: ed.legenda, hashtags: ed.hashtags, status: 'draft', error: undefined,
    })
    base.cardCount = cardCountFor(base)
    return await saveEdition(base)
  } catch (err: any) {
    base.status = 'error'
    base.error  = String(err?.message ?? err)
    await saveEdition(base)
    throw err
  }
}

// ── Cards ──────────────────────────────────────────────────────────────────
export async function renderAndStoreCards(e: Edition): Promise<string[]> {
  const total = cardCountFor(e)
  const urls: string[] = []
  for (let n = 0; n < total; n++) {
    await saveImage(e.date, n, await renderCard(e, n))
    urls.push(imageUrl(e.date, n))
  }
  e.cardCount = total
  return urls
}

// ── Publicação ─────────────────────────────────────────────────────────────
export interface PublishOptions {
  fromCron?: boolean   // respeita rejeição e SCEMALTA_AUTO_PUBLISH
  skipInstagram?: boolean
}

export async function publishEdition(date: string, opts: PublishOptions = {}): Promise<{ edition: Edition; skipped?: string }> {
  const e = await getEdition(date)
  if (!e) throw new Error(`Edição ${date} não existe.`)
  if (e.status === 'published') return { edition: e, skipped: 'já publicada' }
  if (e.status === 'error' || e.noticias.length === 0) throw new Error(`Edição ${date} não está pronta (${e.status}).`)

  if (opts.fromCron) {
    if (e.status === 'rejected') return { edition: e, skipped: 'rejeitada no painel' }
    const auto = (process.env.SCEMALTA_AUTO_PUBLISH ?? 'true').toLowerCase() !== 'false'
    if (!auto && e.status !== 'approved') return { edition: e, skipped: 'aguardando aprovação (SCEMALTA_AUTO_PUBLISH=false)' }
  }

  try {
    const urls = await renderAndStoreCards(e)
    if (!opts.skipInstagram && instagramConfigured()) {
      e.instagram = await publishToInstagram(urls, buildCaption(e))
    }
    e.status = 'published'
    e.error  = undefined
    return { edition: await saveEdition(e) }
  } catch (err: any) {
    e.status = 'error'
    e.error  = String(err?.message ?? err)
    await saveEdition(e)
    throw err
  }
}
