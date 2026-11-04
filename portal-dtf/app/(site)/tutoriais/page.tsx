import type { Metadata } from 'next'
import { listPublished } from '@/lib/store'
import { ArticleGrid, CategoryNav } from '../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Tutoriais de DTF',
  description: 'Todos os tutoriais de DTF e estamparia: arte, impressão, pó, cura, prensagem, problemas, manutenção e negócio.',
}

export default async function Tutoriais() {
  const list = await listPublished()
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Tutoriais de DTF</h1>
        <p className="text-slate-400">{list.length} tutoriais práticos, do preparo do arquivo à prensagem.</p>
      </header>
      <CategoryNav />
      <ArticleGrid list={list} />
    </div>
  )
}
