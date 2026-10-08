import Link from 'next/link'
import { listPublished } from '@/lib/store'
import { BRAND } from '@/lib/brand'
import { CATEGORIES, CATEGORY_INFO } from '@/lib/types'
import { ArticleGrid, SectionTitle } from './ui'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const published = await listPublished()
  const count = (c: string) => published.filter(a => a.categoria === c).length

  return (
    <div className="space-y-16">
      <section className="space-y-5 py-6">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-ui-pink">DTF e estamparia, sem enrolação</p>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
          Do arquivo à prensa: tutoriais para produzir <span className="text-ui-accent">DTF</span> sem desperdício.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
          Preparo de arte, impressão, pó, cura, prensagem por tecido, defeitos e como resolver, precificação e gang sheet.
          Escrito para quem produz todo dia.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/tutoriais" className="rounded-xl bg-ui-accent px-5 py-3 text-sm font-black text-ui-black hover:bg-ui-accent-dim">Ver tutoriais</Link>
          <Link href="/ferramentas/custo-dtf" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black hover:border-ui-accent">Calcular custo do DTF</Link>
        </div>
      </section>

      <section>
        <SectionTitle>Tutoriais mais recentes</SectionTitle>
        {published.length === 0
          ? <p className="rounded-2xl border border-white/10 p-8 text-center text-slate-400">Os primeiros tutoriais do {BRAND.name} estão sendo preparados.</p>
          : <ArticleGrid list={published.slice(0, 9)} />}
      </section>

      <section>
        <SectionTitle>Por assunto</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map(c => (
            <Link key={c} href={`/categoria/${c}`} className="rounded-2xl border border-white/10 p-4 hover:border-ui-accent/50">
              <p className="font-black">{CATEGORY_INFO[c].label} <span className="text-xs font-semibold text-slate-500">({count(c)})</span></p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{CATEGORY_INFO[c].desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-ui-accent/30 bg-gradient-to-br from-ui-accent/10 to-ui-pink/10 p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-ui-accent">Para estamparias</p>
        <h2 className="mt-3 text-2xl font-black md:text-3xl">Pare de montar gang sheet na mão.</h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Encaixe automático das artes no filme, finalização e checagem dos arquivos para DTF: menos filme desperdiçado e menos reimpressão.
        </p>
        <Link href="/solucoes" className="mt-5 inline-block rounded-xl bg-ui-accent px-5 py-3 text-sm font-black text-ui-black hover:bg-ui-accent-dim">Conhecer as soluções</Link>
      </section>
    </div>
  )
}
