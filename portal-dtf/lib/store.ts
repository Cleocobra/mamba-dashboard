// Persistência dos artigos, da fila de pautas e das imagens dos cards.
// Redis (lib/redis) em produção; sem Redis configurado, cai em memória
// (útil só para desenvolvimento local — nada sobrevive ao restart).

import { redisExec } from '@/lib/redis'
import type { Article, Lead, Topic } from './types'

const PREFIX       = process.env.PORTAL_REDIS_PREFIX || 'portaldtf'
const KEY_ARTICLE  = (slug: string) => `${PREFIX}:article:${slug}`
const KEY_SLUGS    = `${PREFIX}:slugs`
const KEY_TOPICS   = `${PREFIX}:topics`
const KEY_LEADS    = `${PREFIX}:leads`
const KEY_RATE     = (ip: string) => `${PREFIX}:rate:${ip}`
const KEY_IMG      = (slug: string, n: number) => `${PREFIX}:img:${slug}:${n}`
const IMG_TTL_SEC  = 60 * 60 * 24 * 120   // 120 dias (o site re-renderiza se expirar)

const hasRedis = () =>
  Boolean(process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN))

// ── Fallback em memória ────────────────────────────────────────────────────
// Fica em globalThis para ser compartilhado entre os bundles de rotas e páginas.
type MemStore = { articles: Map<string, Article>; topics: Topic[]; images: Map<string, string>; leads: Lead[] }
const g = globalThis as unknown as { __portalMem?: MemStore }
const mem: MemStore = (g.__portalMem ??= { articles: new Map(), topics: [], images: new Map(), leads: [] })

// ── Artigos ────────────────────────────────────────────────────────────────
export async function getArticle(slug: string): Promise<Article | null> {
  if (!hasRedis()) return mem.articles.get(slug) ?? null
  const raw = await redisExec(['GET', KEY_ARTICLE(slug)])
  if (!raw) return null
  try { return JSON.parse(raw) as Article } catch { return null }
}

export async function saveArticle(a: Article): Promise<Article> {
  a.updatedAt = new Date().toISOString()
  if (!hasRedis()) { mem.articles.set(a.slug, a); return a }
  await redisExec(['SET', KEY_ARTICLE(a.slug), JSON.stringify(a)])
  await redisExec(['SADD', KEY_SLUGS, a.slug])
  return a
}

export async function deleteArticle(slug: string, cards: number): Promise<void> {
  await deleteImages(slug, cards)
  if (!hasRedis()) { mem.articles.delete(slug); return }
  await redisExec(['DEL', KEY_ARTICLE(slug)])
  await redisExec(['SREM', KEY_SLUGS, slug])
}

export async function slugExists(slug: string): Promise<boolean> {
  if (!hasRedis()) return mem.articles.has(slug)
  return Number(await redisExec(['SISMEMBER', KEY_SLUGS, slug])) === 1
}

// Todos os artigos, do mais recente para o mais antigo (publicação, senão criação).
export async function listArticles(): Promise<Article[]> {
  let out: Article[]
  if (!hasRedis()) out = Array.from(mem.articles.values())
  else {
    const slugs = ((await redisExec(['SMEMBERS', KEY_SLUGS])) as string[] | null) ?? []
    const all = await Promise.all(slugs.map(getArticle))
    out = all.filter((a): a is Article => a !== null)
  }
  const when = (a: Article) => a.publishedAt || a.createdAt
  return out.sort((a, b) => when(b).localeCompare(when(a)))
}

export async function listPublished(): Promise<Article[]> {
  return (await listArticles()).filter(a => a.status === 'published')
}

// ── Pautas ─────────────────────────────────────────────────────────────────
export async function listTopics(): Promise<Topic[]> {
  if (!hasRedis()) return [...mem.topics]
  const raw = await redisExec(['GET', KEY_TOPICS])
  if (!raw) return []
  try { return JSON.parse(raw) as Topic[] } catch { return [] }
}

export async function saveTopics(list: Topic[]): Promise<void> {
  if (!hasRedis()) { mem.topics = [...list]; return }
  await redisExec(['SET', KEY_TOPICS, JSON.stringify(list)])
}

// Próxima pauta: maior prioridade, depois a mais antiga.
export function nextTopic(list: Topic[]): Topic | undefined {
  return list
    .filter(t => !t.usedBy)
    .sort((a, b) => b.prioridade - a.prioridade || a.createdAt.localeCompare(b.createdAt))[0]
}

// ── Imagens (JPEG em base64) ───────────────────────────────────────────────
export async function getImage(slug: string, n: number): Promise<Buffer | null> {
  const key = KEY_IMG(slug, n)
  const b64 = hasRedis() ? await redisExec(['GET', key]) : mem.images.get(key)
  return b64 ? Buffer.from(b64, 'base64') : null
}

export async function saveImage(slug: string, n: number, jpeg: Buffer): Promise<void> {
  const key = KEY_IMG(slug, n)
  const b64 = jpeg.toString('base64')
  if (!hasRedis()) { mem.images.set(key, b64); return }
  await redisExec(['SET', key, b64, 'EX', IMG_TTL_SEC])
}

export async function deleteImages(slug: string, count: number): Promise<void> {
  for (let n = 0; n < count; n++) {
    const key = KEY_IMG(slug, n)
    if (!hasRedis()) mem.images.delete(key)
    else await redisExec(['DEL', key])
  }
}

// ── Interessados ───────────────────────────────────────────────────────────
export async function addLead(l: Lead): Promise<void> {
  if (!hasRedis()) { mem.leads.unshift(l); return }
  await redisExec(['LPUSH', KEY_LEADS, JSON.stringify(l)])
}

export async function listLeads(limit = 200): Promise<Lead[]> {
  if (!hasRedis()) return mem.leads.slice(0, limit)
  const raw = ((await redisExec(['LRANGE', KEY_LEADS, 0, limit - 1])) as string[] | null) ?? []
  return raw.flatMap(r => { try { return [JSON.parse(r) as Lead] } catch { return [] } })
}

// Limite simples por IP para o formulário público (sem Redis, não limita).
export async function hitRateLimit(ip: string, max: number, windowSec: number): Promise<boolean> {
  if (!hasRedis()) return false
  const n = Number(await redisExec(['INCR', KEY_RATE(ip)]))
  if (n === 1) await redisExec(['EXPIRE', KEY_RATE(ip), windowSec])
  return n > max
}
