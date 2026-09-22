// Teste local sem rede: parser de RSS com fixture + renderização dos cards em JPEG.
// Uso: npx tsx scripts/scemalta-smoke.ts [pasta-de-saida]
import fs from 'node:fs'
import path from 'node:path'
import { parseFeed } from '../lib/scemalta/sources'
import { cardCountFor, renderCard } from '../lib/scemalta/render'
import type { Edition } from '../lib/scemalta/types'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>G1 SC</title>
<item><title><![CDATA[Porto de Itajaí bate recorde de movimentação em agosto]]></title>
<link>https://g1.globo.com/sc/santa-catarina/noticia/2026/09/22/porto-itajai-recorde.ghtml</link>
<description><![CDATA[<p>O porto movimentou <b>1,2 milhão</b> de toneladas &amp; cresceu 18% frente a 2025.</p>]]></description>
<pubDate>Tue, 22 Sep 2026 09:15:00 -0300</pubDate></item>
<item><title>Governo abre edital de R$ 40 milhões para inovação</title>
<link>https://estado.sc.gov.br/noticias/edital-inovacao</link>
<content:encoded><![CDATA[Empresas de todos os portes podem se inscrever até 30 de outubro.]]></content:encoded>
<dc:date>2026-09-22T08:00:00-03:00</dc:date></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Feed</title>
<entry><title type="html">Chuva forte deve atingir o Vale do Itajaí nesta quarta</title>
<link rel="alternate" href="https://ndmais.com.br/tempo/chuva-vale"/><updated>2026-09-22T07:30:00-03:00</updated>
<summary>Defesa Civil alerta para volumes acima de 80 mm.</summary></entry></feed>`

const rss = parseFeed(RSS, 'G1 SC')
const atom = parseFeed(ATOM, 'ND Mais')
console.log('RSS items:', rss.length, JSON.stringify(rss[0]))
console.log('Atom items:', atom.length, JSON.stringify(atom[0]))
if (rss.length !== 2 || atom.length !== 1) throw new Error('parseFeed falhou')
if (rss[0].summary?.includes('<') || !rss[0].summary?.includes('&')) throw new Error('stripHtml falhou: ' + rss[0].summary)

const edition: Edition = {
  date: '2026-09-22', status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  manchete: 'Porto de Itajaí bate recorde e SC abre edital de R$ 40 mi',
  noticias: [
    { titulo: 'Porto de Itajaí bate recorde de movimentação em agosto', resumo: 'O complexo portuário movimentou 1,2 milhão de toneladas no mês, alta de 18% sobre agosto de 2025. O resultado foi puxado por contêineres e cargas frigoríficas.', categoria: 'economia', fonte: 'G1 SC', link: 'https://g1.globo.com/' },
    { titulo: 'Governo abre edital de R$ 40 milhões para inovação', resumo: 'A FAPESC vai financiar projetos de empresas de todos os portes. As inscrições ficam abertas até 30 de outubro.', categoria: 'economia', fonte: 'Agência SECOM SC', link: 'https://estado.sc.gov.br/' },
    { titulo: 'Chuva forte deve atingir o Vale do Itajaí nesta quarta', resumo: 'A Defesa Civil alerta para volumes acima de 80 mm em 24 horas. Municípios do Médio Vale estão em atenção para alagamentos.', categoria: 'clima', fonte: 'ND Mais', link: 'https://ndmais.com.br/' },
    { titulo: 'Joinville terá nova fábrica de baterias com 600 vagas', resumo: 'A unidade deve começar a operar no segundo semestre de 2027, com investimento de R$ 900 milhões.', categoria: 'infraestrutura', fonte: 'Economia SC', link: 'https://economiasc.com/' },
    { titulo: 'Florianópolis aprova novo plano de mobilidade para a Ilha', resumo: 'O texto prevê corredores de ônibus e ciclovias ligando o centro ao norte da Ilha até 2030.', categoria: 'cidades', fonte: 'NSC Total', link: 'https://www.nsctotal.com.br/' },
  ],
  oportunidades: [
    { titulo: 'Edital FAPESC de inovação: R$ 40 mi', descricao: 'Para empresas de todos os portes com sede em SC. Inscrições até 30 de outubro.', tipo: 'edital', fonte: 'Agência SECOM SC', link: 'https://estado.sc.gov.br/' },
    { titulo: 'Feira de fornecedores da indústria de baterias', descricao: 'Cadastro de fornecedores locais para a nova fábrica em Joinville abre em outubro.', tipo: 'evento', fonte: 'Economia SC', link: 'https://economiasc.com/' },
  ],
  legenda: 'teste', hashtags: ['SantaCatarina', 'SC'], rawCount: 3, cardCount: 0,
}
edition.cardCount = cardCountFor(edition)

async function main() {
  const out = process.argv[2] || path.join(process.cwd(), '.scemalta-smoke')
  fs.mkdirSync(out, { recursive: true })
  for (let n = 0; n < edition.cardCount; n++) {
    const t = Date.now()
    const jpeg = await renderCard(edition, n)
    fs.writeFileSync(path.join(out, `card-${n}.jpg`), jpeg)
    console.log(`card-${n}.jpg ${(jpeg.length / 1024).toFixed(0)} KB em ${Date.now() - t} ms`)
  }
  console.log('OK →', out)
}
main().catch(e => { console.error(e); process.exit(1) })
