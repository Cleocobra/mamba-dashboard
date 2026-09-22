// Publicação no Instagram via Graph API (Content Publishing).
// Requer conta Business/Creator, IG_USER_ID e IG_ACCESS_TOKEN com a permissão
// instagram_content_publish. As imagens precisam estar em URL pública, em JPEG.

import type { InstagramResult } from './types'

const API_VER = 'v20.0'
const API     = `https://graph.facebook.com/${API_VER}`
const CAPTION_MAX = 2200

function cfg(): { userId: string; token: string } | null {
  const userId = process.env.IG_USER_ID
  const token  = process.env.IG_ACCESS_TOKEN
  return userId && token ? { userId, token } : null
}

export const instagramConfigured = () => cfg() !== null

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function graph<T = any>(path: string, params: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const { token } = cfg()!
  const body = new URLSearchParams({ ...params, access_token: token })
  const url  = method === 'GET' ? `${API}/${path}?${body}` : `${API}/${path}`
  const res  = await fetch(url, method === 'GET'
    ? { cache: 'no-store' }
    : { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    const e = json?.error
    throw new Error(`Instagram API ${res.status}: ${e?.message ?? 'erro desconhecido'}${e?.error_user_msg ? ` — ${e.error_user_msg}` : ''}`)
  }
  return json as T
}

async function waitUntilReady(creationId: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const r = await graph<{ status_code?: string; status?: string }>(creationId, { fields: 'status_code,status' }, 'GET')
    if (r.status_code === 'FINISHED') return
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`Container ${creationId} com status ${r.status_code}: ${r.status ?? ''}`)
    await sleep(5000)
  }
  throw new Error(`Container ${creationId} não ficou pronto a tempo.`)
}

// Publica 1 imagem ou um carrossel de 2 a 10 imagens. Devolve o id do post e o permalink.
export async function publishToInstagram(imageUrls: string[], caption: string): Promise<InstagramResult> {
  const c = cfg()
  if (!c) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN não configurados.')
  if (imageUrls.length === 0) throw new Error('Nenhuma imagem para publicar.')
  if (imageUrls.length > 10) throw new Error('O Instagram aceita no máximo 10 imagens por carrossel.')
  const cap = caption.length > CAPTION_MAX ? caption.slice(0, CAPTION_MAX - 1) + '…' : caption

  let creationId: string
  if (imageUrls.length === 1) {
    const r = await graph<{ id: string }>(`${c.userId}/media`, { image_url: imageUrls[0], caption: cap })
    creationId = r.id
  } else {
    const children: string[] = []
    for (const url of imageUrls) {
      const r = await graph<{ id: string }>(`${c.userId}/media`, { image_url: url, is_carousel_item: 'true' })
      children.push(r.id)
    }
    const r = await graph<{ id: string }>(`${c.userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: cap })
    creationId = r.id
  }

  await waitUntilReady(creationId)
  const pub = await graph<{ id: string }>(`${c.userId}/media_publish`, { creation_id: creationId })

  let permalink: string | undefined
  try {
    const info = await graph<{ permalink?: string }>(pub.id, { fields: 'permalink' }, 'GET')
    permalink = info.permalink
  } catch { /* permalink é opcional */ }

  return { mediaId: pub.id, permalink, publishedAt: new Date().toISOString() }
}
