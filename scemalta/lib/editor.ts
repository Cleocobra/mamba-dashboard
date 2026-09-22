// Edição com Claude: escolhe as 5 notícias do dia, escreve resumos com as
// próprias palavras, separa oportunidades para empresários e redige a legenda.
// A saída é JSON validado por schema (structured outputs), e os links/fontes
// são sempre resolvidos pelo id do item coletado — o modelo nunca inventa URL.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { NewsItem, Opportunity, RawItem } from './types'

const MODEL = process.env.SCEMALTA_MODEL || 'claude-opus-5'

const CATEGORIAS = ['economia', 'politica', 'cidades', 'seguranca', 'clima', 'infraestrutura', 'educacao', 'saude', 'cultura', 'esporte', 'outro'] as const
const TIPOS      = ['licitacao', 'edital', 'evento', 'investimento', 'indicador', 'outro'] as const

const NoticiaSchema = z.object({
  id:        z.number().int().describe('id do item coletado que originou a notícia'),
  titulo:    z.string().describe('título curto e claro, até 90 caracteres, sem clickbait'),
  resumo:    z.string().describe('2 a 3 frases com as próprias palavras, sem copiar trechos da fonte'),
  categoria: z.enum(CATEGORIAS),
})

const OportunidadeSchema = z.object({
  id:        z.number().int().describe('id do item coletado que originou a oportunidade'),
  titulo:    z.string().describe('até 70 caracteres'),
  descricao: z.string().describe('1 a 2 frases: o que é, para quem serve e prazo se houver'),
  tipo:      z.enum(TIPOS),
})

const EdicaoSchema = z.object({
  manchete:      z.string().describe('chamada da capa, até 60 caracteres, sem ponto final'),
  noticias:      z.array(NoticiaSchema).describe('exatamente 5 notícias, da mais para a menos relevante'),
  oportunidades: z.array(OportunidadeSchema).describe('de 0 a 4 oportunidades concretas para quem empreende em SC'),
  legenda:       z.string().describe('legenda do Instagram, até 1500 caracteres, sem hashtags'),
  hashtags:      z.array(z.string()).describe('8 a 12 hashtags sem o símbolo # e sem espaços'),
})

export type EditorialDraft = z.infer<typeof EdicaoSchema>

export interface EditorialResult {
  manchete:      string
  noticias:      NewsItem[]
  oportunidades: Opportunity[]
  legenda:       string
  hashtags:      string[]
  model:         string
}

const SYSTEM = `Você é o editor-chefe do "SC em Alta", um veículo digital diário sobre Santa Catarina.
Público: catarinenses em geral e, em especial, empresários e empreendedores do estado.
Promessa da marca: todo dia, o que está em alta em SC, com um olhar de oportunidade.

Você recebe uma lista de itens coletados hoje (título, resumo curto, fonte, id). Sua tarefa:

1. Escolher as 5 notícias mais relevantes do dia para o estado. Critérios, nesta ordem:
   impacto real na vida ou nos negócios em SC; relevância econômica; diversidade de temas e de regiões
   (litoral, norte, vale, oeste, serra, sul); notícias de abrangência estadual antes de fatos muito locais.
   Evite crimes violentos e tragédias pessoais, salvo quando o impacto for coletivo.
2. Reescrever cada notícia em 2 a 3 frases com as suas próprias palavras. Nunca copie frases da fonte.
   Tom claro, direto, neutro, sem adjetivos de opinião e sem sensacionalismo. Inclua números e datas quando houver.
3. Separar de 0 a 4 oportunidades concretas para quem empreende em SC: editais, licitações, feiras e eventos
   de negócios, investimentos anunciados, linhas de crédito, dados de mercado que orientem decisão.
   Só inclua o que vier dos itens coletados. Se não houver nada concreto, devolva a lista vazia.
4. Escrever a manchete da capa: até 60 caracteres, sem ponto final, sem clickbait.
5. Escrever a legenda do Instagram: comece com a manchete, liste as 5 notícias numeradas em uma linha cada,
   se houver oportunidades destaque em uma linha, e termine convidando para o link na bio. Sem hashtags na legenda.
6. Listar de 8 a 12 hashtags relevantes, sem o símbolo # e sem espaços, misturando gerais (SantaCatarina, SC)
   e específicas do dia.

Regras invioláveis:
- Use apenas informações presentes nos itens. Não invente fatos, números, nomes ou datas.
- Cada notícia e cada oportunidade deve apontar o id do item coletado que a originou.
- Não repita a mesma notícia em duas posições nem use dois itens que contem o mesmo fato.
- Escreva em português do Brasil.`

function resolve(raw: RawItem[], id: number): RawItem | undefined {
  return raw.find(r => r.id === id)
}

export async function editDay(date: string, raw: RawItem[]): Promise<EditorialResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada.')
  const client = new Anthropic()

  const compact = raw.map(r => ({
    id: r.id, fonte: r.source, titulo: r.title, resumo: r.summary ?? '', publicado: r.publishedAt || null,
  }))
  const user = `Data da edição: ${date}\nTotal de itens coletados: ${raw.length}\n\nItens (JSON):\n${JSON.stringify(compact)}`

  const response = await client.beta.messages.parse({
    model:      MODEL,
    max_tokens: 16000,
    betas:      ['server-side-fallback-2026-07-01'],
    fallbacks:  'default',
    system:     [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages:   [{ role: 'user', content: user }],
    output_config: { format: betaZodOutputFormat(EdicaoSchema) },
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(`O modelo recusou a edição (${response.stop_details?.category ?? 'sem categoria'}).`)
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Resposta do modelo cortada por max_tokens.')
  const draft = response.parsed_output
  if (!draft) throw new Error('Não foi possível interpretar a resposta do modelo.')

  // Resolve fonte e link pelo id — descarta o que não bate com a coleta.
  const usados = new Set<number>()
  const noticias: NewsItem[] = []
  for (const n of draft.noticias) {
    const src = resolve(raw, n.id)
    if (!src || usados.has(n.id)) continue
    usados.add(n.id)
    noticias.push({ titulo: n.titulo.trim(), resumo: n.resumo.trim(), categoria: n.categoria, fonte: src.source, link: src.link })
    if (noticias.length === 5) break
  }
  if (noticias.length < 3) throw new Error(`Edição com poucas notícias válidas (${noticias.length}).`)

  const oportunidades: Opportunity[] = []
  for (const o of draft.oportunidades) {
    const src = resolve(raw, o.id)
    if (!src) continue
    oportunidades.push({ titulo: o.titulo.trim(), descricao: o.descricao.trim(), tipo: o.tipo, fonte: src.source, link: src.link })
    if (oportunidades.length === 4) break
  }

  const hashtags = Array.from(new Set(
    draft.hashtags.map(h => h.replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean)
  )).slice(0, 12)

  return {
    manchete: draft.manchete.trim().replace(/\.$/, '').slice(0, 80),
    noticias,
    oportunidades,
    legenda: draft.legenda.trim().slice(0, 1800),
    hashtags,
    model: response.model,
  }
}
