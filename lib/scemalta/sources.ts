// Coleta de notícias: feeds RSS/Atom de veículos catarinenses + Brave News API (opcional).
// Tudo aqui é leitura: nada é publicado ou gravado.

import { XMLParser } from 'fast-xml-parser'
import type { RawItem } from './types'

export interface FeedSource { name: string; url: string }

export interface CollectStats { source: string; count: number; error?: string }

export interface CollectResult { items: RawItem[]; stats: CollectStats[] }

// Feeds padrão. Sobrescreva com SCEMALTA_RSS_FEEDS="Nome|https://url,Nome2|https://url2".
export const DEFAULT_FEEDS: FeedSource[] = [
  { name: 'G1 SC',             url: 'https://g1.globo.com/rss/g1/sc/santa-catarina/' },
  { name: 'ND Mais',           url: 'https://ndmais.com.br/feed/' },
  { name: 'Agência SECOM SC',  url: 'https://estado.sc.gov.br/noticias/feed/' },
  { name: 'Agência Sebrae SC', url: 'https://sc.agenciasebrae.com.br/feed/' },
  { name: 'Economia SC',       url: 'https://economiasc.com/feed/' },
]

const WINDOW_HOURS = Number(process.env.SCEMALTA_WINDOW_HOURS || 36)
const MAX_ITEMS    = Number(process.env.SCEMALTA_MAX_ITEMS || 60)
const UA           = 'SCemAlta/1.0 (+https://scemalta.com.br)'

export function configuredFeeds(): FeedSource[] {
  const env = process.env.SCEMALTA_RSS_FEEDS
  if (!env) return DEFAULT_FEEDS
  return env.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const [name, url] = entry.split('|').map(p => p.trim())
    return url ? { name, url } : { name: entry, url: entry }
  })
}

// ── Utilidades de texto ────────────────────────────────────────────────────
function text(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return text(v[0])
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('#text' in o) return text(o['#text'])
    if ('@_href' in o) return text(o['@_href'])
  }
  return ''
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

export function stripHtml(html: string, max = 320): string {
  const s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

function normalizeTitle(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDate(v: unknown): string {
  const s = text(v)
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

// ── RSS / Atom ─────────────────────────────────────────────────────────────
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true })

// Exportado para testes. Aceita RSS 2.0 e Atom.
export function parseFeed(xml: string, sourceName: string): Omit<RawItem, 'id'>[] {
  const doc = parser.parse(xml) as Record<string, any>
  const out: Omit<RawItem, 'id'>[] = []

  const rssItems = doc?.rss?.channel?.item
  const atomEntries = doc?.feed?.entry
  const list: any[] = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems]
                    : Array.isArray(atomEntries) ? atomEntries : atomEntries ? [atomEntries] : []

  for (const it of list) {
    const title = stripHtml(text(it.title), 200)
    let link = text(it.link)
    if (!link && Array.isArray(it.link)) {
      const alt = it.link.find((l: any) => !l?.['@_rel'] || l['@_rel'] === 'alternate')
      link = text(alt)
    }
    if (!link) link = text(it.guid)
    if (!title || !/^https?:\/\//.test(link)) continue

    const summarySrc = it['content:encoded'] ?? it.description ?? it.summary ?? it.content
    const summary = stripHtml(text(summarySrc))
    const publishedAt = parseDate(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'])
    out.push({ title, link, source: sourceName, publishedAt, summary: summary || undefined })
  }
  return out
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

export async function fetchFeed(src: FeedSource): Promise<Omit<RawItem, 'id'>[]> {
  const res = await fetchWithTimeout(src.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return parseFeed(await res.text(), src.name)
}

// ── Brave News API ─────────────────────────────────────────────────────────
const BRAVE_QUERIES = ['Santa Catarina', 'Santa Catarina empresas economia']

export async function fetchBraveNews(query: string): Promise<Omit<RawItem, 'id'>[]> {
  const key = process.env.BRAVE_API_KEY
  if (!key) return []
  const url = new URL('https://api.search.brave.com/res/v1/news/search')
  url.searchParams.set('q', query)
  url.searchParams.set('country', 'BR')
  url.searchParams.set('search_lang', 'pt-br')
  url.searchParams.set('ui_lang', 'pt-BR')
  url.searchParams.set('freshness', 'pd')
  url.searchParams.set('count', '30')
  const res = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key, 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}`)
  const json = await res.json() as { results?: any[] }
  return (json.results ?? []).map(r => ({
    title:       stripHtml(text(r.title), 200),
    link:        text(r.url),
    source:      text(r.meta_url?.hostname) || text(r.source) || 'Brave News',
    publishedAt: parseDate(r.page_age),
    summary:     stripHtml(text(r.description)) || undefined,
  })).filter(r => r.title && /^https?:\/\//.test(r.link))
}

// ── Coleta consolidada ─────────────────────────────────────────────────────
export async function collect(): Promise<CollectResult> {
  const feeds = configuredFeeds()
  const tasks: Promise<{ source: string; items: Omit<RawItem, 'id'>[] }>[] = [
    ...feeds.map(async f => ({ source: f.name, items: await fetchFeed(f) })),
    ...(process.env.BRAVE_API_KEY
      ? BRAVE_QUERIES.map(async q => ({ source: `Brave: ${q}`, items: await fetchBraveNews(q) }))
      : []),
  ]
  const names = [...feeds.map(f => f.name), ...(process.env.BRAVE_API_KEY ? BRAVE_QUERIES.map(q => `Brave: ${q}`) : [])]

  const settled = await Promise.allSettled(tasks)
  const stats: CollectStats[] = []
  const all: Omit<RawItem, 'id'>[] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') { stats.push({ source: names[i], count: r.value.items.length }); all.push(...r.value.items) }
    else stats.push({ source: names[i], count: 0, error: String(r.reason?.message ?? r.reason) })
  })

  // Janela de tempo (itens sem data passam) + deduplicação por link e por título.
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000
  const seenLink = new Set<string>()
  const seenTitle = new Set<string>()
  const items: RawItem[] = []
  const sorted = all.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  for (const it of sorted) {
    if (it.publishedAt && new Date(it.publishedAt).getTime() < cutoff) continue
    const linkKey = it.link.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
    const titleKey = normalizeTitle(it.title)
    if (seenLink.has(linkKey) || seenTitle.has(titleKey)) continue
    seenLink.add(linkKey); seenTitle.add(titleKey)
    items.push({ id: items.length, ...it })
    if (items.length >= MAX_ITEMS) break
  }
  return { items, stats }
}
