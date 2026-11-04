import Link from 'next/link'
import { CATEGORIES, CATEGORY_INFO, LEVEL_LABEL, type Article } from '@/lib/types'

export function ArticleCard({ a }: { a: Article }) {
  return (
    <Link href={`/tutoriais/${a.slug}`} className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-ui-accent/50">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ui-accent">{CATEGORY_INFO[a.categoria]?.label}</p>
      <h3 className="mt-2 text-lg font-black leading-snug group-hover:text-ui-accent">{a.titulo}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{a.resumo}</p>
      <p className="mt-4 text-xs text-slate-500">{LEVEL_LABEL[a.nivel]} · {a.tempoMin} min de leitura</p>
    </Link>
  )
}

export function ArticleGrid({ list }: { list: Article[] }) {
  if (list.length === 0) return <p className="text-sm text-slate-400">Nenhum tutorial publicado aqui ainda.</p>
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map(a => <ArticleCard key={a.slug} a={a} />)}</div>
}

export function CategoryNav({ active }: { active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/tutoriais" className={`rounded-full border px-3 py-1.5 text-xs font-bold ${!active ? 'border-ui-accent bg-ui-accent text-ui-black' : 'border-white/15 text-slate-300 hover:border-ui-accent'}`}>Todos</Link>
      {CATEGORIES.map(c => (
        <Link key={c} href={`/categoria/${c}`}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${active === c ? 'border-ui-accent bg-ui-accent text-ui-black' : 'border-white/15 text-slate-300 hover:border-ui-accent'}`}>
          {CATEGORY_INFO[c].label}
        </Link>
      ))}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-ui-accent">{children}</h2>
}
