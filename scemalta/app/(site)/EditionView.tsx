import type { Edition } from '@/lib/types'
import { cardCountFor } from '@/lib/render'

export function formatLongDate(date: string): string {
  const d = new Date(`${date}T12:00:00-03:00`)
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const TIPO: Record<string, string> = {
  licitacao: 'Licitação', edital: 'Edital', evento: 'Evento', investimento: 'Investimento', indicador: 'Indicador', outro: 'Oportunidade',
}

export function EditionView({ edition: e }: { edition: Edition }) {
  const cards = cardCountFor(e)
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ui-accent">{formatLongDate(e.date)}</p>
        <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{e.manchete}</h1>
        {e.instagram?.permalink && (
          <a href={e.instagram.permalink} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-ui-accent hover:underline">
            Ver no Instagram →
          </a>
        )}
      </header>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {Array.from({ length: cards }, (_, n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={n}
            src={`/api/img/${e.date}/${n}.jpg?v=${encodeURIComponent(e.updatedAt)}`}
            alt={n === 0 ? e.manchete : `Card ${n}`}
            width={1080}
            height={1350}
            loading={n === 0 ? 'eager' : 'lazy'}
            className="w-64 shrink-0 snap-start rounded-xl border border-white/10"
          />
        ))}
      </div>

      <section className="space-y-6">
        {e.noticias.map((n, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ui-accent">{String(i + 1).padStart(2, '0')} · {n.categoria}</p>
            <h2 className="mt-2 text-xl font-black leading-snug">{n.titulo}</h2>
            <p className="mt-2 leading-relaxed text-slate-300">{n.resumo}</p>
            <a href={n.link} target="_blank" rel="noreferrer nofollow" className="mt-3 inline-block text-sm font-semibold text-slate-400 hover:text-ui-accent">
              Ler na fonte: {n.fonte} →
            </a>
          </div>
        ))}
      </section>

      {e.oportunidades.length > 0 && (
        <section className="rounded-2xl border border-ui-accent/30 bg-ui-accent/5 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-ui-accent">Oportunidades para quem empreende em SC</h2>
          <ul className="mt-4 space-y-4">
            {e.oportunidades.map((o, i) => (
              <li key={i}>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{TIPO[o.tipo] ?? 'Oportunidade'}</p>
                <p className="mt-1 font-black">{o.titulo}</p>
                <p className="mt-1 text-sm text-slate-300">{o.descricao}</p>
                <a href={o.link} target="_blank" rel="noreferrer nofollow" className="mt-1 inline-block text-xs font-semibold text-slate-400 hover:text-ui-accent">
                  {o.fonte} →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
