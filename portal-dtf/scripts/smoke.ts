// Teste local sem rede e sem IA: slug, tempo de leitura, fila de pautas e cards em JPEG.
// Uso: npx tsx scripts/smoke.ts [pasta-de-saida]
import fs from 'node:fs'
import path from 'node:path'
import { cardCountFor, renderCard } from '../lib/render'
import { nextTopic } from '../lib/store'
import { readingMinutes, slugify, isValidSlug } from '../lib/utils'
import type { Article, Topic } from '../lib/types'

const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg) }

const slug = slugify('Como prensar DTF em poliamida? (130 °C)')
console.log('slug:', slug)
assert(slug === 'como-prensar-dtf-em-poliamida-130-c' && isValidSlug(slug), 'slugify falhou')

const now = new Date().toISOString()
const topics: Topic[] = [
  { id: 'a', titulo: 'Baixa', prioridade: 3, origem: 'ia', createdAt: '2026-10-01T00:00:00Z' },
  { id: 'b', titulo: 'Alta antiga', prioridade: 8, origem: 'manual', createdAt: '2026-10-01T00:00:00Z' },
  { id: 'c', titulo: 'Alta nova', prioridade: 8, origem: 'manual', createdAt: '2026-10-05T00:00:00Z' },
  { id: 'd', titulo: 'Usada', prioridade: 10, origem: 'manual', createdAt: now, usedBy: 'x' },
]
assert(nextTopic(topics)?.id === 'b', 'nextTopic deveria escolher a de maior prioridade mais antiga')

const article: Article = {
  slug: 'dtf-descascando-na-lavagem', status: 'draft', createdAt: now, updatedAt: now,
  titulo: 'DTF descascando na lavagem: 6 causas e como resolver',
  resumo: 'Descubra por que a estampa DTF solta depois de lavar e ajuste prensagem, cura do pó e pós-prensa para resolver.',
  categoria: 'problemas', nivel: 'iniciante', tempoMin: 0,
  introducao: 'Estampa soltando depois da primeira lavagem é a reclamação mais comum de quem começa no DTF.',
  materiais: ['Prensa térmica', 'Termômetro infravermelho', 'Papel siliconado'],
  passos: [
    { titulo: 'Meça a temperatura real da prensa', texto: 'O mostrador pode mentir. Use um termômetro infravermelho em vários pontos do prato e compare com o valor configurado.' },
    { titulo: 'Confira a cura do pó', texto: 'O pó precisa derreter por completo e ficar com aspecto de casca de laranja. Pó granulado é cura insuficiente.' },
    { titulo: 'Pré-prense a peça', texto: 'Prense a peça por 3 a 5 segundos antes de aplicar para tirar umidade e rugas.' },
    { titulo: 'Ajuste tempo e pressão', texto: 'Para algodão, a faixa típica é 150 a 165 °C por 10 a 15 segundos com pressão firme. Confirme na ficha do seu filme.' },
    { titulo: 'Faça a pós-prensa', texto: 'Depois de tirar o filme, prense de novo por 5 a 10 segundos com papel siliconado por cima.' },
  ],
  dicas: ['Anote os parâmetros que funcionaram para cada tecido.'],
  problemas: [{ problema: 'Solta só nas bordas', solucao: 'Pressão desigual ou berço gasto: confira o nivelamento.' }],
  faq: [{ pergunta: 'Quanto tempo esperar para lavar?', resposta: 'O ideal é 24 horas.' }],
  conclusao: 'Na maioria dos casos o problema está na prensagem ou na cura do pó.',
  palavrasChave: ['dtf descascando'], legenda: 'teste', hashtags: ['dtf'], cardCount: 0,
}
article.tempoMin = readingMinutes(article)
article.cardCount = cardCountFor(article)
assert(article.cardCount === 7, `cardCount esperado 7, veio ${article.cardCount}`)

async function main() {
  const out = process.argv[2] || path.join(process.cwd(), '.portal-smoke')
  fs.mkdirSync(out, { recursive: true })
  for (let n = 0; n < article.cardCount; n++) {
    const t = Date.now()
    const jpeg = await renderCard(article, n)
    fs.writeFileSync(path.join(out, `card-${n}.jpg`), jpeg)
    console.log(`card-${n}.jpg ${(jpeg.length / 1024).toFixed(0)} KB em ${Date.now() - t} ms`)
  }
  console.log('OK →', out)
}
main().catch(e => { console.error(e); process.exit(1) })
