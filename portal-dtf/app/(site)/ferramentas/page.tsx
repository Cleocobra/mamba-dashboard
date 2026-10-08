import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Ferramentas para DTF',
  description: 'Calculadoras e ferramentas gratuitas para quem produz DTF: custo por metro, preço por estampa e aproveitamento do filme.',
}

const TOOLS = [
  { href: '/ferramentas/custo-dtf', title: 'Calculadora de custo DTF', desc: 'Custo por metro de filme, custo por estampa e preço sugerido com a sua margem.', ready: true },
  { href: '/solucoes', title: 'Encaixe automático (gang sheet)', desc: 'Monte o filme com o máximo de aproveitamento sem arrastar arte por arte.', ready: false },
  { href: '/solucoes', title: 'Checagem de arquivo para DTF', desc: 'DPI, fundo transparente, semitransparências e traços finos demais, antes de imprimir.', ready: false },
]

export default function Ferramentas() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Ferramentas</h1>
        <p className="text-slate-400">Para calcular, planejar e produzir com menos desperdício.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(t => (
          <Link key={t.title} href={t.href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-ui-accent/50">
            <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${t.ready ? 'text-ui-accent' : 'text-ui-pink'}`}>{t.ready ? 'Grátis' : 'Solução'}</p>
            <h2 className="mt-2 text-lg font-black">{t.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
