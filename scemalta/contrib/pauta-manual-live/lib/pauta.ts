// Pauta manual: uma matéria escolhida pela equipe (link mandado no WhatsApp ou colado no painel)
// entra no plantão de hoje como notícia avulsa e vai para aprovação, igual às que o radar encontra.
// Aprovada pelo link (/plantao/DATA/IDX?t=...), é publicada no portal e no Instagram.
//
// Arquivo novo: não altera plantao.ts. Reusa o que ele exporta e os mesmos registros do Redis.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { redisExec } from './redis'
import { readCapped, safeFetch } from './cover'
import { enrichNews, extractArticleText } from './materia'
import { synthMany } from './voice'
import { renderCard } from './render'
import { getEdition, getImage, saveImage } from './store'
import { getPlantao, plantaoN, plantaoUrl, pseudoEdition, type PlantaoEntry } from './plantao'
import { SOLO_OFFSET, soloImageUrl, todaySP } from './pipeline'
import { notifyAll, sendImage, whatsappConfigured } from './whatsapp'
import type { NewsItem } from './types'

const MODEL      = process.env.SCEMALTA_MODEL || 'claude-opus-5'
const EXPIRA_H   = () => Number(process.env.SCEMALTA_RADAR_EXPIRA_H || 4)
const CATEGORIAS = ['economia', 'politica', 'cidades', 'seguranca', 'clima', 'infraestrutura', 'educacao', 'saude', 'cultura', 'esporte', 'outro'] as const

// Mesmas chaves do plantao.ts (savePlantao não é exportado de lá).
const KEY       = (date: string) => `scemalta:plantao:${date}`
const KEY_DATES = 'scemalta:plantao:dates'
async function savePlantao(date: string, list: PlantaoEntry[]): Promise<void> {
  await redisExec(['SET', KEY(date), JSON.stringify(list)])
  await redisExec(['SADD', KEY_DATES, date])
}

// ── Leitura da página ──────────────────────────────────────────────────────
function meta(html: string, key: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'))
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''
}

async function lerPagina(url: string): Promise<{ texto: string; titulo: string; descricao: string; veiculo: string }> {
  const u = new URL(url)
  const res = await safeFetch(u.toString(), 'text/html,application/xhtml+xml')
  const html = (await readCapped(res, 3_000_000)).toString('utf8')
  const titulo = meta(html, 'og:title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim()
  return {
    texto:     extractArticleText(html),
    titulo,
    descricao: meta(html, 'og:description') || meta(html, 'description'),
    veiculo:   meta(html, 'og:site_name') || u.hostname.replace(/^www\./, ''),
  }
}

// ── Título e resumo do portal ──────────────────────────────────────────────
const PautaSchema = z.object({
  titulo:    z.string().describe('título do portal, até 90 caracteres, sem clickbait'),
  resumo:    z.string().describe('2 a 3 frases com as próprias palavras, só com fatos do material recebido'),
  categoria: z.enum(CATEGORIAS),
  fonte:     z.string().describe('nome curto do veículo de origem (ex.: G1 SC, NSC Total, ND Mais); use o domínio se não souber'),
})

const SYSTEM = `Você é editor do "SC em Alta", portal e Instagram de notícias de Santa Catarina
(público: catarinenses em geral e quem empreende no estado).
A equipe escolheu UMA matéria para virar post avulso e te mandou o link. Você recebe o título original,
a descrição, o veículo e o texto da página. Escreva o título do portal (até 90 caracteres, sem clickbait),
um resumo de 2 a 3 frases com as suas próprias palavras, só com fatos do material, e classifique a categoria.
Nunca copie frases da fonte; não invente números, nomes ou datas. Português do Brasil.`

async function escrever(p: Awaited<ReturnType<typeof lerPagina>>, url: string) {
  const client = new Anthropic()
  const user = `URL: ${url}\nVeículo: ${p.veiculo}\nTítulo original: ${p.titulo}\nDescrição: ${p.descricao}\n\nTexto da matéria:\n${p.texto.slice(0, 12_000) || '(indisponível; use título e descrição)'}`
  const r = await client.beta.messages.parse({
    model: MODEL, max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    output_config: { format: betaZodOutputFormat(PautaSchema) },
  })
  if (!r.parsed_output) throw new Error(`resposta do modelo ilegível (${r.stop_reason})`)
  return r.parsed_output
}

// ── Card + pedido de aprovação (mesmo formato do radar) ────────────────────
function horaSP(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

async function ensureCard(date: string, e: PlantaoEntry): Promise<string> {
  const key = SOLO_OFFSET + plantaoN(e.idx)
  if (!(await getImage(date, key))) await saveImage(date, key, await renderCard(pseudoEdition(date, e), 1, { solo: true }))
  return soloImageUrl(date, plantaoN(e.idx))
}

async function pedirAprovacao(date: string, e: PlantaoEntry, origem: string): Promise<void> {
  if (!whatsappConfigured()) return
  const card = await ensureCard(date, e)
  const expira = horaSP(new Date(new Date(e.criadoEm).getTime() + EXPIRA_H() * 3600_000).toISOString())
  const caption = [
    `*Pauta manual SC em Alta* — ${origem}`,
    '',
    `*${e.item.titulo}*`,
    e.item.resumo,
    `Fonte: ${e.item.fonte}`,
    '',
    `Aprovar e publicar agora: ${plantaoUrl(date, e.idx)}`,
    `(vale até ${expira})`,
  ].join('\n')
  await notifyAll(n => sendImage(n, card, caption))
}

// ── Entrada principal ──────────────────────────────────────────────────────
export async function addManualPauta(url: string, origem: string): Promise<{ entry: PlantaoEntry; aprovar: string; date: string }> {
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Link inválido.')
  const date = todaySP()
  const list = await getPlantao(date)
  const repetida = list.find(e => e.item.link === url && e.status !== 'rejected')
  if (repetida) throw new Error(`Essa matéria já está no plantão de hoje (${repetida.status}). Aprovar: ${plantaoUrl(date, repetida.idx)}`)

  const pagina = await lerPagina(url)
  if (!pagina.titulo && !pagina.texto) throw new Error('Não consegui ler o conteúdo dessa página.')
  const a = await escrever(pagina, url)

  const idx = list.reduce((m, e) => Math.max(m, e.idx), 0) + 1
  const item: NewsItem = { titulo: a.titulo.trim(), resumo: a.resumo.trim(), categoria: a.categoria, fonte: (a.fonte || pagina.veiculo).trim(), link: url }
  // Matéria completa + foto (mesma posição que o radar usaria: 50 + idx).
  await enrichNews(date, [item], { offset: plantaoN(idx) - 1 })
  if (!item.foto) throw new Error('A matéria não tem foto utilizável, e o card do post precisa de uma foto.')
  await synthMany(date, [{ n: plantaoN(idx), item }]).catch(() => [])

  const edition = await getEdition(date)
  const slugs = new Set([...(edition?.noticias ?? []).map(n => n.slug), ...list.map(e => e.item.slug)].filter(Boolean) as string[])
  while (item.slug && slugs.has(item.slug)) item.slug = `${item.slug}-2`

  const entry: PlantaoEntry = { idx, status: 'pending', nota: 10, motivo: `Pauta manual (${origem})`, item, criadoEm: new Date().toISOString() }
  list.push(entry)
  await savePlantao(date, list)
  await pedirAprovacao(date, entry, origem)
  return { entry, aprovar: plantaoUrl(date, idx), date }
}

export const firstUrl = (text: string): string | null => {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[),.;!?]+$/, '') : null
}
