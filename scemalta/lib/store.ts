// Persistência das edições e das imagens dos cards.
// Usa o Redis do dashboard (lib/redis). Sem Redis configurado, cai em memória
// (útil só para desenvolvimento local — nada sobrevive ao restart).

import { redisExec } from '@/lib/redis'
import type { Edition } from './types'

const KEY_EDITION = (date: string) => `scemalta:edition:${date}`
const KEY_DATES   = 'scemalta:dates'
const KEY_IMG     = (date: string, n: number) => `scemalta:img:${date}:${n}`
const IMG_TTL_SEC = 60 * 60 * 24 * 90   // 90 dias

const hasRedis = () =>
  Boolean(process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN))

// ── Fallback em memória ────────────────────────────────────────────────────
// Fica em globalThis para ser compartilhado entre os bundles de rotas e páginas
// do Next (cada um carrega a própria cópia deste módulo).
type MemStore = { editions: Map<string, Edition>; images: Map<string, string> }
const g = globalThis as unknown as { __scemaltaMem?: MemStore }
const mem: MemStore = (g.__scemaltaMem ??= { editions: new Map(), images: new Map() })

// ── Edições ────────────────────────────────────────────────────────────────
export async function getEdition(date: string): Promise<Edition | null> {
  if (!hasRedis()) return mem.editions.get(date) ?? null
  const raw = await redisExec(['GET', KEY_EDITION(date)])
  if (!raw) return null
  try { return JSON.parse(raw) as Edition } catch { return null }
}

export async function saveEdition(edition: Edition): Promise<Edition> {
  edition.updatedAt = new Date().toISOString()
  if (!hasRedis()) { mem.editions.set(edition.date, edition); return edition }
  await redisExec(['SET', KEY_EDITION(edition.date), JSON.stringify(edition)])
  await redisExec(['SADD', KEY_DATES, edition.date])
  return edition
}

export async function listDates(): Promise<string[]> {
  const dates: string[] = hasRedis()
    ? ((await redisExec(['SMEMBERS', KEY_DATES])) as string[] | null) ?? []
    : Array.from(mem.editions.keys())
  return dates.sort().reverse()
}

export async function listEditions(limit = 30): Promise<Edition[]> {
  const dates = (await listDates()).slice(0, limit)
  const out: Edition[] = []
  for (const d of dates) {
    const e = await getEdition(d)
    if (e) out.push(e)
  }
  return out
}

// ── Imagens (JPEG em base64) ───────────────────────────────────────────────
export async function getImage(date: string, n: number): Promise<Buffer | null> {
  const key = KEY_IMG(date, n)
  const b64 = hasRedis() ? await redisExec(['GET', key]) : mem.images.get(key)
  return b64 ? Buffer.from(b64, 'base64') : null
}

export async function saveImage(date: string, n: number, jpeg: Buffer): Promise<void> {
  const key = KEY_IMG(date, n)
  const b64 = jpeg.toString('base64')
  if (!hasRedis()) { mem.images.set(key, b64); return }
  await redisExec(['SET', key, b64, 'EX', IMG_TTL_SEC])
}

export async function deleteImages(date: string, count: number): Promise<void> {
  for (let n = 0; n < count; n++) {
    const key = KEY_IMG(date, n)
    if (!hasRedis()) mem.images.delete(key)
    else await redisExec(['DEL', key])
  }
}
