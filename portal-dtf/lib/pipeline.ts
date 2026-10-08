// Orquestração do portal: pauta → tutorial (Claude) → rascunho → cards → site + Instagram.
// Também concentra a autorização das rotas.

import type { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { publicBaseUrl } from './brand'
import { suggestTopics, writeArticle } from './editor'
import { cardCountFor, renderCard } from './render'
import { instagramConfigured, publishToInstagram } from './instagram'
import {
  getArticle, listArticles, listTopics, nextTopic, saveArticle, saveImage, saveTopics, slugExists,
} from './store'
import { readingMinutes, slugify } from './utils'
import type { Article, Category, Topic } from './types'

// ── URLs públicas ──────────────────────────────────────────────────────────
export const imageUrl   = (slug: string, n: number) => `${publicBaseUrl()}/api/img/${slug}/${n}.jpg`
export const articleUrl = (slug: string) => `${publicBaseUrl()}/tutoriais/${slug}`

export function buildCaption(a: Article): string {
  const tags = a.hashtags.map(h => `#${h}`).join(' ')
  return tags ? `${a.legenda}\n\n${tags}` : a.legenda
}

// ── Autorização: Bearer CRON_SECRET (agendador) ou login básico do painel ─────
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

const autoPublish = () => (process.env.PORTAL_AUTO_PUBLISH ?? 'true').toLowerCase() !== 'false'

// ── Pautas ─────────────────────────────────────────────────────────────────
export interface NewTopic { titulo: string; categoria?: Category; palavraChave?: string; notas?: string; prioridade?: number }

export async function addTopics(items: NewTopic[], origem: Topic['origem']): Promise<Topic[]> {
  const list = await listTopics()
  const seen = new Set(list.map(t => slugify(t.titulo)))
  const added: Topic[] = []
  for (const it of items) {
    const titulo = it.titulo?.trim()
    if (!titulo || seen.has(slugify(titulo))) continue
    seen.add(slugify(titulo))
    const t: Topic = {
      id: randomUUID(), titulo: titulo.slice(0, 140), categoria: it.categoria, palavraChave: it.palavraChave?.trim() || undefined,
      notas: it.notas?.trim() || undefined, prioridade: Math.max(1, Math.min(10, Math.round(it.prioridade ?? 5))),
      origem, createdAt: new Date().toISOString(),
    }
    list.push(t); added.push(t)
  }
  await saveTopics(list)
  return added
}

// Pede ao Claude novas pautas, evitando o que já foi publicado ou está na fila.
export async function refillTopics(count = 10): Promise<Topic[]> {
  const [topics, articles] = await Promise.all([listTopics(), listArticles()])
  const existing = [...articles.map(a => a.titulo), ...topics.map(t => t.titulo)]
  const suggested = await suggestTopics(count, existing)
  return addTopics(suggested, 'ia')
}

// ── Geração do tutorial ────────────────────────────────────────────────────
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || `tutorial-${Date.now()}`
  if (!(await slugExists(base))) return base
  for (let i = 2; i < 50; i++) if (!(await slugExists(`${base}-${i}`))) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

export async function generateArticle(opts: { topicId?: string } = {}): Promise<Article> {
  let topics = await listTopics()
  let topic = opts.topicId ? topics.find(t => t.id === opts.topicId) : nextTopic(topics)
  if (opts.topicId && !topic) throw new Error('Pauta não encontrada.')
  if (topic?.usedBy && opts.topicId) throw new Error(`Esta pauta já virou o tutorial "${topic.usedBy}".`)

  // Fila vazia: a própria IA abastece a pauta.
  if (!topic) {
    await refillTopics(10)
    topics = await listTopics()
    topic = nextTopic(topics)
    if (!topic) throw new Error('Fila de pautas vazia e a sugestão automática não trouxe nada novo.')
  }

  const published = (await listArticles()).map(a => a.titulo)
  const draft = await writeArticle(topic, published)
  const now = new Date().toISOString()
  const article: Article = {
    ...draft,
    slug: await uniqueSlug(draft.titulo),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    tempoMin: readingMinutes(draft),
    cardCount: cardCountFor(draft),
  }
  await saveArticle(article)

  // Marca a pauta como usada (relê a lista para não sobrescrever pautas adicionadas no meio).
  const fresh = await listTopics()
  const t = fresh.find(x => x.id === topic!.id)
  if (t) { t.usedBy = article.slug; await saveTopics(fresh) }
  return article
}

// Agendador: gera N tutoriais (PORTAL_ARTICLES_PER_RUN, padrão 1). Erros de um não param os outros.
export async function runDaily(): Promise<{ created: Article[]; errors: string[] }> {
  const n = Math.max(1, Math.min(5, Number(process.env.PORTAL_ARTICLES_PER_RUN || 1)))
  const created: Article[] = []
  const errors: string[] = []
  for (let i = 0; i < n; i++) {
    try { created.push(await generateArticle()) }
    catch (err: any) { errors.push(String(err?.message ?? err)) }
  }
  return { created, errors }
}

// ── Cards ──────────────────────────────────────────────────────────────────
export async function renderAndStoreCards(a: Article): Promise<string[]> {
  const total = cardCountFor(a)
  const urls: string[] = []
  for (let n = 0; n < total; n++) {
    await saveImage(a.slug, n, await renderCard(a, n))
    urls.push(imageUrl(a.slug, n))
  }
  a.cardCount = total
  return urls
}

// ── Publicação ─────────────────────────────────────────────────────────────
export interface PublishOptions { fromCron?: boolean; skipInstagram?: boolean }

export async function publishArticle(slug: string, opts: PublishOptions = {}): Promise<{ article: Article; skipped?: string }> {
  const a = await getArticle(slug)
  if (!a) throw new Error(`Tutorial ${slug} não existe.`)
  if (a.status === 'published') return { article: a, skipped: 'já publicado' }
  if (a.passos.length === 0) throw new Error(`Tutorial ${slug} não está pronto (${a.status}).`)

  if (opts.fromCron) {
    if (a.status === 'rejected') return { article: a, skipped: 'rejeitado no painel' }
    if (!autoPublish() && a.status !== 'approved') return { article: a, skipped: 'aguardando aprovação (PORTAL_AUTO_PUBLISH=false)' }
  }

  try {
    const urls = await renderAndStoreCards(a)
    a.status = 'published'
    a.publishedAt = new Date().toISOString()
    a.error = undefined
    // Publica no site antes do Instagram: o link na bio já precisa funcionar.
    await saveArticle(a)
    if (!opts.skipInstagram && instagramConfigured()) {
      a.instagram = await publishToInstagram(urls, buildCaption(a))
      await saveArticle(a)
    }
    return { article: a }
  } catch (err: any) {
    // Falha no Instagram não tira o tutorial do site; só registra o erro.
    a.error = String(err?.message ?? err)
    if (a.status !== 'published') a.status = 'error'
    await saveArticle(a)
    throw err
  }
}

// Agendador: publica os rascunhos não rejeitados (ou só os aprovados, sem auto-publicação).
export async function publishPending(): Promise<{ published: string[]; skipped: string[]; errors: string[] }> {
  const pending = (await listArticles()).filter(a => a.status === 'draft' || a.status === 'approved')
  const published: string[] = [], skipped: string[] = [], errors: string[] = []
  for (const a of pending.reverse()) {   // mais antigo primeiro
    try {
      const r = await publishArticle(a.slug, { fromCron: true })
      if (r.skipped) skipped.push(`${a.slug}: ${r.skipped}`); else published.push(a.slug)
    } catch (err: any) { errors.push(`${a.slug}: ${String(err?.message ?? err)}`) }
  }
  return { published, skipped, errors }
}
