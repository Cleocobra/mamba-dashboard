import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getArticle, listPublished } from '@/lib/store'
import { BRAND, publicBaseUrl } from '@/lib/brand'
import { cardCountFor } from '@/lib/render'
import { formatDate, isValidSlug } from '@/lib/utils'
import { CATEGORY_INFO, LEVEL_LABEL, type Article } from '@/lib/types'
import { ArticleCard, SectionTitle } from '../../ui'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

async function load(slug: string): Promise<Article | null> {
  if (!isValidSlug(slug)) return null
  const a = await getArticle(slug)
  return a && a.status === 'published' ? a : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await load(slug)
  if (!a) return {}
  return {
    title: a.titulo,
    description: a.resumo,
    keywords: a.palavrasChave,
    alternates: { canonical: `/tutoriais/${a.slug}` },
    openGraph: {
      type: 'article', title: a.titulo, description: a.resumo, publishedTime: a.publishedAt,
      images: [{ url: `/api/img/${a.slug}/0.jpg`, width: 1080, height: 1350 }],
    },
  }
}

// Dados estruturados: HowTo (passo a passo) + FAQPage — ajudam o Google a mostrar rich results.
function jsonLd(a: Article) {
  const url = `${publicBaseUrl()}/tutoriais/${a.slug}`
  const graph: object[] = [{
    '@type': 'HowTo',
    name: a.titulo,
    description: a.resumo,
    image: `${publicBaseUrl()}/api/img/${a.slug}/0.jpg`,
    totalTime: `PT${a.tempoMin}M`,
    supply: a.materiais.map(m => ({ '@type': 'HowToSupply', name: m })),
    step: a.passos.map((p, i) => ({ '@type': 'HowToStep', position: i + 1, name: p.titulo, text: p.texto, url: `${url}#passo-${i + 1}` })),
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    publisher: { '@type': 'Organization', name: BRAND.name, url: publicBaseUrl() },
  }]
  if (a.faq.length) graph.push({
    '@type': 'FAQPage',
    mainEntity: a.faq.map(f => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta } })),
  })
  return { '@context': 'https://schema.org', '@graph': graph }
}

export default async function TutorialPage({ params }: Props) {
  const { slug } = await params
  const a = await load(slug)
  if (!a) notFound()

  const related = (await listPublished()).filter(x => x.slug !== a.slug && x.categoria === a.categoria).slice(0, 3)
  const cards = cardCountFor(a)

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(a)).replace(/</g, '\\u003c') }} />

      <header className="space-y-4">
        <nav className="text-xs text-slate-500">
          <Link href="/tutoriais" className="hover:text-ui-accent">Tutoriais</Link> /{' '}
          <Link href={`/categoria/${a.categoria}`} className="hover:text-ui-accent">{CATEGORY_INFO[a.categoria].label}</Link>
        </nav>
        <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">{a.titulo}</h1>
        <p className="text-sm text-slate-400">
          {LEVEL_LABEL[a.nivel]} · {a.tempoMin} min de leitura{a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ''}
        </p>
        <p className="text-lg leading-relaxed text-slate-300">{a.introducao}</p>
      </header>

      {a.materiais.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <SectionTitle>Você vai precisar</SectionTitle>
          <ul className="grid gap-2 text-slate-300 sm:grid-cols-2">
            {a.materiais.map((m, i) => <li key={i} className="flex gap-2"><span className="text-ui-accent">•</span>{m}</li>)}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Passo a passo</SectionTitle>
        <ol className="space-y-6">
          {a.passos.map((p, i) => (
            <li key={i} id={`passo-${i + 1}`} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ui-accent font-black text-ui-black">{i + 1}</span>
              <div>
                <h2 className="text-lg font-black">{p.titulo}</h2>
                <p className="mt-1 leading-relaxed text-slate-300">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {a.dicas.length > 0 && (
        <section className="rounded-2xl border border-ui-yellow/30 bg-ui-yellow/5 p-5">
          <SectionTitle>Dicas de produção</SectionTitle>
          <ul className="space-y-2 text-slate-300">
            {a.dicas.map((d, i) => <li key={i} className="flex gap-2"><span className="text-ui-yellow">★</span>{d}</li>)}
          </ul>
        </section>
      )}

      {a.problemas.length > 0 && (
        <section>
          <SectionTitle>Deu errado? Causas e soluções</SectionTitle>
          <div className="space-y-3">
            {a.problemas.map((p, i) => (
              <div key={i} className="rounded-2xl border border-ui-pink/25 bg-ui-pink/5 p-4">
                <p className="font-black">{p.problema}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{p.solucao}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {a.faq.length > 0 && (
        <section>
          <SectionTitle>Perguntas frequentes</SectionTitle>
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10">
            {a.faq.map((f, i) => (
              <details key={i} className="group p-4">
                <summary className="cursor-pointer list-none font-bold group-open:text-ui-accent">{f.pergunta}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <p className="leading-relaxed text-slate-300">{a.conclusao}</p>

      <p className="rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-slate-400">
        Temperaturas, tempos e pressões são faixas de referência. Filmes, pós e prensas variam: confirme na ficha técnica do
        fornecedor e faça um teste em retalho antes de produzir em quantidade.
      </p>

      <section>
        <SectionTitle>Resumo em cards</SectionTitle>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {Array.from({ length: cards }, (_, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={`/api/img/${a.slug}/${n}.jpg?v=${encodeURIComponent(a.updatedAt)}`} alt={n === 0 ? a.titulo : `Passo ${n}`}
              width={1080} height={1350} loading="lazy" className="w-56 shrink-0 snap-start rounded-xl border border-white/10" />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-ui-accent/30 bg-ui-accent/5 p-6">
        <p className="font-black">Monta gang sheet ou finaliza arquivo de cliente todo dia?</p>
        <p className="mt-1 text-sm text-slate-300">Automatize o encaixe e a checagem das artes e economize filme.</p>
        <Link href="/solucoes" className="mt-3 inline-block text-sm font-black text-ui-accent hover:underline">Ver as soluções →</Link>
      </section>

      {related.length > 0 && (
        <section>
          <SectionTitle>Leia também</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">{related.map(r => <ArticleCard key={r.slug} a={r} />)}</div>
        </section>
      )}
    </article>
  )
}
