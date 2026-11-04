// Redação com Claude: transforma uma pauta em tutorial completo (passos, dicas,
// problemas, FAQ, legenda do Instagram) e sugere novas pautas quando a fila esvazia.
// Saída em JSON validado por schema (structured outputs). Parâmetros técnicos vêm
// da base de conhecimento (lib/knowledge.ts) ou das notas da pauta — nunca inventados.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { BRAND } from './brand'
import { KNOWLEDGE_BASE } from './knowledge'
import { CATEGORIES, CATEGORY_INFO, LEVELS, type Article, type Category, type Topic } from './types'

const MODEL = process.env.PORTAL_MODEL || 'claude-opus-5-5'

// ── Schemas ────────────────────────────────────────────────────────────────
const ArtigoSchema = z.object({
  titulo:        z.string().describe('título do tutorial, até 70 caracteres, com a palavra-chave no começo quando natural, sem clickbait'),
  resumo:        z.string().describe('meta description: 1 frase de até 155 caracteres dizendo o que a pessoa vai aprender'),
  categoria:     z.enum(CATEGORIES),
  nivel:         z.enum(LEVELS),
  introducao:    z.string().describe('2 a 4 frases: o problema, para quem é, o que vai resolver'),
  materiais:     z.array(z.string()).describe('0 a 10 itens: equipamentos e insumos necessários'),
  passos:        z.array(z.object({
    titulo: z.string().describe('até 50 caracteres, começa com verbo no imperativo'),
    texto:  z.string().describe('2 a 4 frases práticas; parâmetros como faixa e com ressalva quando aplicável'),
  })).describe('3 a 9 passos na ordem de execução'),
  dicas:         z.array(z.string()).describe('2 a 5 dicas de quem produz no dia a dia'),
  problemas:     z.array(z.object({ problema: z.string(), solucao: z.string() })).describe('0 a 5 problemas comuns ligados ao tema e como resolver'),
  faq:           z.array(z.object({ pergunta: z.string(), resposta: z.string() })).describe('3 a 5 perguntas reais de busca com respostas de 1 a 3 frases'),
  conclusao:     z.string().describe('1 a 2 frases de fechamento'),
  palavrasChave: z.array(z.string()).describe('4 a 8 termos de busca relacionados'),
  legenda:       z.string().describe('legenda do Instagram até 1200 caracteres, sem hashtags: gancho na primeira linha, resumo dos passos, convite para o link na bio'),
  hashtags:      z.array(z.string()).describe('8 a 12 hashtags sem # e sem espaços'),
})

const PautasSchema = z.object({
  pautas: z.array(z.object({
    titulo:       z.string().describe('tema em forma de pergunta ou "Como fazer X", até 80 caracteres'),
    categoria:    z.enum(CATEGORIES),
    palavraChave: z.string().describe('termo que a pessoa digitaria no Google'),
    prioridade:   z.number().int().describe('1 a 10: volume de busca provável + utilidade para quem produz DTF'),
  })),
})

export type ArticleDraft = Omit<Article, 'slug' | 'status' | 'createdAt' | 'updatedAt' | 'cardCount' | 'tempoMin'>

// ── Prompts (estáveis, ficam em cache) ─────────────────────────────────────
const CATS = CATEGORIES.map(c => `- ${c}: ${CATEGORY_INFO[c].desc}`).join('\n')

const SYSTEM_WRITER = `Você é o redator técnico-chefe do "${BRAND.name}", portal brasileiro de tutoriais de estamparia com foco em DTF.
Público: donos de pequenas estamparias, quem está começando no DTF e operadores de produção. Linguagem de chão de fábrica:
clara, direta, sem enrolação, em português do Brasil, tratando o leitor por "você".

Sua tarefa: transformar a pauta recebida em um tutorial completo, prático e confiável.

Regras invioláveis:
- Parâmetros técnicos (temperatura, tempo, pressão, cura, dpi, medidas) só podem vir da BASE TÉCNICA abaixo ou das
  NOTAS DA PAUTA. Use faixas, não um número mágico, e lembre que o filme e o pó de cada fornecedor têm ficha própria.
  Se a base não cobre um parâmetro, diga para testar em retalho e consultar o fornecedor — não invente.
- Não cite marcas, preços ou fornecedores específicos, a menos que estejam nas notas da pauta.
- Se as notas da pauta trouxerem dados de testes próprios, priorize-os sobre a base e deixe claro que são testes de produção.
- Nada de promessas absolutas ("nunca vai sair", "100% garantido").
- Inclua alertas de segurança quando houver calor, pó ou químicos envolvidos.
- Escolha a categoria e o nível que melhor descrevem o tutorial.
- Os passos precisam ser executáveis na ordem. Cada passo começa com verbo.
- FAQ: perguntas que as pessoas realmente buscam sobre o tema, sem repetir os passos.

Categorias:
${CATS}

BASE TÉCNICA:
${KNOWLEDGE_BASE}`

const SYSTEM_PLANNER = `Você é o editor de pauta do "${BRAND.name}", portal brasileiro de tutoriais de DTF e estamparia.
Objetivo do portal: ser a referência em português para quem produz DTF e atrair estamparias que depois comprem
ferramentas de produtividade (encaixe automático de artes em gang sheet, finalização e checagem de arquivos para DTF).

Sugira pautas que:
- respondam dúvidas reais e específicas de quem produz (o que se digita no Google ou pergunta em grupo de WhatsApp);
- cubram as categorias de forma equilibrada, com peso maior em "problemas", "aplicacao", "arte" e "negocio";
- incluam variações de cauda longa (por tecido, por defeito, por etapa), sem duplicar o que já existe;
- de vez em quando, puxem o tema de preparo de arquivo e encaixe/gang sheet, que é onde as ferramentas pagas ajudam.

Categorias:
${CATS}`

// ── Cliente ────────────────────────────────────────────────────────────────
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada.')
  return new Anthropic()
}

function checkStop(r: { stop_reason: string | null; stop_details?: { category?: string | null } | null }) {
  if (r.stop_reason === 'refusal') throw new Error(`O modelo recusou a tarefa (${r.stop_details?.category ?? 'sem categoria'}).`)
  if (r.stop_reason === 'max_tokens') throw new Error('Resposta do modelo cortada por max_tokens.')
}

const clean = (tags: string[]) =>
  Array.from(new Set(tags.map(h => h.replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean))).slice(0, 12)

// ── Redação do tutorial ────────────────────────────────────────────────────
export async function writeArticle(topic: Topic, existingTitles: string[]): Promise<ArticleDraft> {
  const user = [
    `PAUTA: ${topic.titulo}`,
    topic.palavraChave ? `Palavra-chave principal: ${topic.palavraChave}` : '',
    topic.categoria ? `Categoria sugerida: ${topic.categoria}` : '',
    topic.notas ? `NOTAS DA PAUTA (dados do autor, prioridade sobre a base):\n${topic.notas}` : '',
    existingTitles.length ? `Tutoriais já publicados (não repita o conteúdo deles, foque no tema da pauta):\n${existingTitles.slice(0, 80).map(t => `- ${t}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  const response = await client().beta.messages.parse({
    model:      MODEL,
    max_tokens: 16000,
    betas:      ['server-side-fallback-2026-07-01'],
    fallbacks:  'default',
    system:     [{ type: 'text', text: SYSTEM_WRITER, cache_control: { type: 'ephemeral' } }],
    messages:   [{ role: 'user', content: user }],
    output_config: { effort: 'high', format: betaZodOutputFormat(ArtigoSchema) },
  })
  checkStop(response)
  const d = response.parsed_output
  if (!d) throw new Error('Não foi possível interpretar a resposta do modelo.')
  if (d.passos.length < 3) throw new Error(`Tutorial com poucos passos (${d.passos.length}).`)

  return {
    topicId:       topic.id,
    titulo:        d.titulo.trim().replace(/\.$/, '').slice(0, 90),
    resumo:        d.resumo.trim().slice(0, 170),
    categoria:     d.categoria,
    nivel:         d.nivel,
    introducao:    d.introducao.trim(),
    materiais:     d.materiais.map(s => s.trim()).filter(Boolean).slice(0, 12),
    passos:        d.passos.slice(0, 12).map(p => ({ titulo: p.titulo.trim(), texto: p.texto.trim() })),
    dicas:         d.dicas.map(s => s.trim()).filter(Boolean).slice(0, 6),
    problemas:     d.problemas.slice(0, 6),
    faq:           d.faq.slice(0, 6),
    conclusao:     d.conclusao.trim(),
    palavrasChave: d.palavrasChave.slice(0, 8),
    legenda:       d.legenda.trim().slice(0, 1800),
    hashtags:      clean(d.hashtags),
    model:         response.model,
  }
}

// ── Sugestão de pautas ─────────────────────────────────────────────────────
export interface SuggestedTopic { titulo: string; categoria: Category; palavraChave: string; prioridade: number }

export async function suggestTopics(count: number, existing: string[]): Promise<SuggestedTopic[]> {
  const user = `Sugira ${count} pautas novas.\n\nJá existem (publicadas ou na fila) — não repita nem faça variação mínima destas:\n${
    existing.length ? existing.slice(0, 200).map(t => `- ${t}`).join('\n') : '(nenhuma ainda: comece pelos temas mais buscados)'}`

  const response = await client().beta.messages.parse({
    model:      MODEL,
    max_tokens: 8000,
    betas:      ['server-side-fallback-2026-07-01'],
    fallbacks:  'default',
    system:     [{ type: 'text', text: SYSTEM_PLANNER, cache_control: { type: 'ephemeral' } }],
    messages:   [{ role: 'user', content: user }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(PautasSchema) },
  })
  checkStop(response)
  const d = response.parsed_output
  if (!d) throw new Error('Não foi possível interpretar a resposta do modelo.')
  return d.pautas.slice(0, count).map(p => ({
    titulo: p.titulo.trim(), categoria: p.categoria, palavraChave: p.palavraChave.trim(),
    prioridade: Math.max(1, Math.min(10, Math.round(p.prioridade))),
  }))
}
