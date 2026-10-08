// Acesso unificado ao Redis.
// - Se REDIS_URL estiver setado (ex: redis://mamba-redis:6379), usa um Redis
//   padrão via ioredis — caso do self-host no VPS (container long-running).
// - Caso contrário, cai no Upstash REST (UPSTASH_REDIS_REST_*) — caso da Vercel
//   serverless, onde conexões TCP persistentes não são ideais.
// Mesma assinatura de comando ['GET', key] / ['SET', key, value] nos dois casos.

import type { Redis } from 'ioredis'

const REDIS_URL     = process.env.REDIS_URL
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let _client: Redis | null = null

async function client(): Promise<Redis> {
  if (_client) return _client
  const { default: IORedis } = await import('ioredis')
  _client = new IORedis(REDIS_URL as string, { maxRetriesPerRequest: 3 })
  return _client
}

// Executa um comando Redis. Lança em caso de erro real (deixa o chamador decidir
// se trata graciosamente). Retorna o resultado bruto (string|null no GET, "OK" no SET).
export async function redisExec(cmd: (string | number)[]): Promise<any> {
  // 1. Redis padrão (self-host)
  if (REDIS_URL) {
    const c = await client()
    const [name, ...args] = cmd
    const res = await (c as any).call(String(name), ...args.map(String))
    return res ?? null
  }

  // 2. Upstash REST (fallback / Vercel)
  if (!UPSTASH_URL || !UPSTASH_TOKEN)
    throw new Error('Redis não configurado (defina REDIS_URL ou UPSTASH_REDIS_REST_*)')

  const res = await fetch(UPSTASH_URL, {
    method:  'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(cmd),
    cache:   'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Redis REST ${res.status}: ${body}`)
  }
  const data = await res.json()
  return data.result ?? null
}
