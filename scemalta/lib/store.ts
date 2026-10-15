// Persistência das edições e das imagens dos cards.
// Usa o Redis do dashboard (lib/redis). Sem Redis configurado, cai em memória
// (útil só para desenvolvimento local — nada sobrevive ao restart).

import { redisExec } from '@/lib/redis'
import type { Edition } from './types'

const KEY_EDITION = (id: string) => `scemalta:edition:${id}`
const KEY_DATES   = 'scemalta:dates'
const KEY_IMG     = (id: string, n: number) => `scemalta:img:${id}:${n}`
const KEY_PENDING = (from: string) => `scemalta:wa:pending:${from}`
const IMG_TTL_SEC = 60 * 60 * 24 * 90   // 90 dias

const hasRedis = () =>
  Boolean(process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN))

// ── Fallback em memória ────────────────────────────────────────────────────
// Fica em globalThis para ser compartilhado entre os bundles de rotas e páginas
// do Next (cada um carrega a própria cópia deste módulo).
type MemStore = { editions: Map<string, Edition>; images: Map<string, string>; pending: Map<string, string> }
const g = globalThis as unknown as { __scemaltaMem?: MemStore }
const mem: MemStore = (g.__scemaltaMem ??= { editions: new Map(), images: new Map(), pending: new Map() })

// ── Edições ────────────────────────────────────────────────────────────────
// Edições antigas (antes dos posts avulsos) não têm id/kind: normaliza na leitura.
function normalize(e: Edition): Edition {
  e.id   ||= e.date
  e.kind ||= 'diaria'
  return e
}

export async function getEdition(id: string): Promise<Edition | null> {
  if (!hasRedis()) { const e = mem.editions.get(id); return e ? normalize(e) : null }
  const raw = await redisExec(['GET', KEY_EDITION(id)])
  if (!raw) return null
  try { return normalize(JSON.parse(raw) as Edition) } catch { return null }
}

export async function saveEdition(edition: Edition): Promise<Edition> {
  normalize(edition)
  edition.updatedAt = new Date().toISOString()
  if (!hasRedis()) { mem.editions.set(edition.id, edition); return edition }
  await redisExec(['SET', KEY_EDITION(edition.id), JSON.stringify(edition)])
  await redisExec(['SADD', KEY_DATES, edition.id])
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
export async function getImage(id: string, n: number): Promise<Buffer | null> {
  const key = KEY_IMG(id, n)
  const b64 = hasRedis() ? await redisExec(['GET', key]) : mem.images.get(key)
  return b64 ? Buffer.from(b64, 'base64') : null
}

export async function saveImage(id: string, n: number, jpeg: Buffer): Promise<void> {
  const key = KEY_IMG(id, n)
  const b64 = jpeg.toString('base64')
  if (!hasRedis()) { mem.images.set(key, b64); return }
  await redisExec(['SET', key, b64, 'EX', IMG_TTL_SEC])
}

export async function deleteImages(id: string, count: number): Promise<void> {
  for (let n = 0; n < count; n++) {
    const key = KEY_IMG(id, n)
    if (!hasRedis()) mem.images.delete(key)
    else await redisExec(['DEL', key])
  }
}

// ── Post pendente por remetente do WhatsApp (aguardando PUBLICAR/CANCELAR) ──
export async function getPending(from: string): Promise<string | null> {
  if (!hasRedis()) return mem.pending.get(from) ?? null
  return (await redisExec(['GET', KEY_PENDING(from)])) || null
}

export async function setPending(from: string, id: string | null): Promise<void> {
  if (!hasRedis()) { if (id) mem.pending.set(from, id); else mem.pending.delete(from); return }
  if (id) await redisExec(['SET', KEY_PENDING(from), id, 'EX', 60 * 60 * 24])
  else await redisExec(['DEL', KEY_PENDING(from)])
}
