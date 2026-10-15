// Leitura de uma matéria a partir da URL: título, descrição, veículo e texto principal.
// Sem dependências: extração por tags <article>/<main> e limpeza de HTML.

import { stripHtml } from './sources'

export interface Article {
  url:         string
  title:       string
  description: string
  source:      string   // nome do veículo (og:site_name) ou domínio
  text:        string   // texto principal, até ~8000 caracteres
}

const UA = 'Mozilla/5.0 (compatible; SCemAlta/1.0; +https://scemalta.com.br)'
const MAX_BYTES = 2_000_000
const MAX_TEXT  = 8000

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i')
  const m = html.match(re) || html.match(re2)
  return m ? stripHtml(m[1], 500) : ''
}

function pick(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1] : ''
}

export function extractArticle(url: string, html: string): Article {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  const title = meta(clean, 'og:title') || stripHtml(pick(clean, 'title'), 200)
  const description = meta(clean, 'og:description') || meta(clean, 'description')
  const host = new URL(url).hostname.replace(/^www\./, '')
  const source = meta(clean, 'og:site_name') || host

  // Texto principal: <article> > <main> > <body>, sem cabeçalho/rodapé/menus.
  let body = pick(clean, 'article') || pick(clean, 'main') || pick(clean, 'body') || clean
  body = body
    .replace(/<(nav|header|footer|aside|form|figure)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
  const paragraphs = stripHtml(body, 1_000_000).split(/\n+/).map(s => s.trim()).filter(s => s.length > 40)
  const text = paragraphs.join('\n').slice(0, MAX_TEXT)
  return { url, title, description, source, text }
}

export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!m) return null
  return m[0].replace(/[),.;!?]+$/, '')
}

export async function fetchArticle(url: string): Promise<Article> {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol)) throw new Error('Só aceito links http(s).')
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000)
  try {
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      signal: ctl.signal, redirect: 'follow', cache: 'no-store',
    })
    if (!res.ok) throw new Error(`A página respondeu HTTP ${res.status}.`)
    const buf = Buffer.from(await res.arrayBuffer())
    const html = buf.subarray(0, MAX_BYTES).toString('utf8')
    const art = extractArticle(res.url || u.toString(), html)
    if (!art.title && !art.text) throw new Error('Não consegui ler o conteúdo dessa página.')
    return art
  } finally { clearTimeout(t) }
}
