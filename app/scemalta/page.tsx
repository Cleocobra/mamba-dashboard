import Link from 'next/link'
import { listEditions } from '@/lib/scemalta/store'
import { EditionView, formatLongDate } from './EditionView'

export const dynamic = 'force-dynamic'

export default async function SiteHome() {
  const published = (await listEditions(60)).filter(e => e.status === 'published')
  const latest = published[0]

  if (!latest) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl font-black">Em breve</h1>
        <p className="mt-3 text-slate-400">A primeira edição do SC em Alta está sendo preparada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <EditionView edition={latest} />
      {published.length > 1 && (
        <section>
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-[#22C55E]">Edições anteriores</h2>
          <ul className="divide-y divide-white/10">
            {published.slice(1, 15).map(e => (
              <li key={e.date}>
                <Link href={`/scemalta/${e.date}`} className="flex items-center justify-between gap-4 py-3 hover:text-[#22C55E]">
                  <span className="font-semibold">{e.manchete}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatLongDate(e.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
