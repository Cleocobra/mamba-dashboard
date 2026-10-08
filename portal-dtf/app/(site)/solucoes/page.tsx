import type { Metadata } from 'next'
import { BRAND, whatsappLink } from '@/lib/brand'
import { LeadForm } from './LeadForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Soluções para estamparias DTF',
  description: 'Encaixe automático de artes em gang sheet e finalização de arquivos para DTF: menos filme desperdiçado, menos reimpressão.',
}

const SOLUTIONS = [
  {
    tag: 'Encaixe', title: 'Gang sheet montado sozinho',
    desc: 'Você sobe as artes com as quantidades, o sistema encaixa no filme com o máximo de aproveitamento e devolve o arquivo pronto para o RIP.',
    points: ['Rotação e agrupamento automáticos', 'Espaçamento de corte configurável', 'Relatório de metros e aproveitamento por pedido'],
  },
  {
    tag: 'Finalização', title: 'Arquivo de cliente pronto para imprimir',
    desc: 'Checagem e ajuste das artes antes da impressão, do jeito que o DTF exige.',
    points: ['Alerta de DPI baixo no tamanho final', 'Fundo transparente e bordas limpas', 'Semitransparências e traços finos demais sinalizados'],
  },
]

export default function Solucoes() {
  const wa = whatsappLink(`Olá! Vim pelo ${BRAND.name} e quero conhecer as soluções para DTF.`)
  return (
    <div className="space-y-14">
      <header className="max-w-3xl space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-ui-pink">Para estamparias e bureaus de DTF</p>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-5xl">Menos tempo no computador, mais metro impresso.</h1>
        <p className="text-lg text-slate-300">
          Ferramentas feitas por quem produz DTF, para resolver o gargalo entre o arquivo do cliente e a impressora.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {SOLUTIONS.map(s => (
          <section key={s.tag} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ui-accent">{s.tag}</p>
            <h2 className="mt-2 text-2xl font-black">{s.title}</h2>
            <p className="mt-2 text-slate-300">{s.desc}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {s.points.map(p => <li key={p} className="flex gap-2"><span className="text-ui-accent">✓</span>{p}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <section id="contato" className="grid gap-8 rounded-3xl border border-ui-accent/30 bg-ui-accent/5 p-6 md:grid-cols-2 md:p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-black">Quero conhecer</h2>
          <p className="text-slate-300">Deixe seu contato e mostramos como funciona com as artes da sua produção.</p>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-green-500 px-5 py-3 text-sm font-black text-ui-black hover:bg-green-400">
              Falar no WhatsApp
            </a>
          )}
        </div>
        <LeadForm />
      </section>
    </div>
  )
}
