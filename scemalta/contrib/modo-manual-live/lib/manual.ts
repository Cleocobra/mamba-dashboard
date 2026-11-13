// Modo manual do Instagram (IG_MODE=manual).
// Nada vai para a API do Instagram. Cada post que seria publicado vira um pacote no WhatsApp:
// cabeçalho com os links dos originais, os cards na ordem do carrossel, o reel (se houver) e,
// por último, a legenda sozinha, pronta para copiar. A equipe publica pelo celular.
//
// Arquivo novo. O gancho fica em lib/instagram.ts (ver APPLY.md): cada função que chamaria a
// Graph API devolve enviarPacoteManual(...) quando manualMode() é verdadeiro.

import { approvalNumbers, sendImage, sendText, sendVideo, whatsappConfigured } from './whatsapp'

export type PacoteManual = {
  tipo?: string      // "Post avulso", "Carrossel", "Reel"… (se omitido, é deduzido)
  titulo?: string    // se omitido, usa a primeira linha da legenda
  legenda: string    // exatamente o que iria para o Instagram
  imagens?: string[] // URLs públicas dos cards, na ordem do carrossel
  video?: string     // URL pública do mp4 (reel)
  capa?: string      // URL pública da capa do reel, se houver
}

// Mesmo formato que publishToInstagram devolve, para o pipeline registrar o post sem mudar nada.
export type ResultadoManual = { mediaId: string; permalink?: string; publishedAt: string }

// IG_MODE=manual (ou whatsapp/off) liga o modo manual. Qualquer outro valor, ou vazio, = API como antes.
export const manualMode = (): boolean => /^(manual|whatsapp|off)$/i.test((process.env.IG_MODE || '').trim())

// Para quem mandar: MANUAL_WHATSAPP (lista separada por vírgula) ou, se vazio, os números de aprovação.
function destinos(): string[] {
  const extra = (process.env.MANUAL_WHATSAPP || '').split(',').map(s => s.trim()).filter(Boolean)
  return extra.length ? extra : approvalNumbers()
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const primeiraLinha = (s: string): string =>
  (s.split('\n').map(l => l.trim()).find(Boolean) ?? '').replace(/^[*_]+|[*_]+$/g, '').slice(0, 120)

const agoraSP = (): string =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date())

function cabecalho(p: PacoteManual): string {
  const imagens = p.imagens ?? []
  const tipo   = p.tipo ?? (p.video ? 'Reel' : imagens.length > 1 ? `Carrossel (${imagens.length} cards)` : 'Post avulso')
  const titulo = p.titulo ?? primeiraLinha(p.legenda)
  const linhas = [
    `*SC em Alta · ${tipo}* — modo manual, ${agoraSP()}`,
    titulo ? `*${titulo}*` : '',
    '',
    'Como publicar: salve os cards abaixo na ordem, suba no Instagram e cole a legenda da última mensagem (segure nela > Copiar).',
  ]
  if (imagens.length) linhas.push('', 'Cards em alta resolução:', ...imagens.map((u, i) => `${i + 1}. ${u}`))
  if (p.video) linhas.push('', `Reel original (mp4): ${p.video}`)
  if (p.capa)  linhas.push(`Capa do reel: ${p.capa}`)
  return linhas.join('\n')
}

// Manda o pacote para cada número e devolve um "resultado de publicação" com id manual:...
// Nunca lança: se o WhatsApp falhar, registra no log e o pipeline segue (o site já está publicado).
export async function enviarPacoteManual(p: PacoteManual): Promise<ResultadoManual> {
  const mediaId     = `manual:${Date.now()}`
  const publishedAt = new Date().toISOString()
  const imagens     = p.imagens ?? []
  if (!whatsappConfigured()) {
    console.warn('[manual] WhatsApp não configurado; pacote não enviado:', primeiraLinha(p.legenda))
    return { mediaId, publishedAt }
  }
  const nums = destinos()
  for (const num of nums) {
    try {
      await sendText(num, cabecalho(p))
      for (let i = 0; i < imagens.length; i++) {
        await sleep(400) // mantém a ordem das mensagens no WhatsApp
        await sendImage(num, imagens[i], imagens.length > 1 ? `Card ${i + 1}/${imagens.length}` : 'Card do post')
      }
      if (p.video) { await sleep(400); await sendVideo(num, p.video, 'Reel (comprimido pelo WhatsApp; o original está no link do cabeçalho)') }
      await sleep(400)
      await sendText(num, p.legenda) // última mensagem: só a legenda, para copiar com um toque
    } catch (err) {
      console.error('[manual] falha ao enviar pacote para', num, err)
    }
  }
  console.log(`[manual] pacote enviado (${imagens.length} card(s)${p.video ? ' + reel' : ''}) para ${nums.length} número(s)`)
  return { mediaId, publishedAt }
}
