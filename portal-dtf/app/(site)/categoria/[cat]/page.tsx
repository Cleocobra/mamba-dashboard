import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listPublished } from '@/lib/store'
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/lib/types'
import { ArticleGrid, CategoryNav } from '../../ui'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ cat: string }> }
const isCat = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params
  if (!isCat(cat)) return {}
  return { title: `${CATEGORY_INFO[cat].label} · DTF`, description: CATEGORY_INFO[cat].desc }
}

export default async function CategoriaPage({ params }: Props) {
  const { cat } = await params
  if (!isCat(cat)) notFound()
  const list = (await listPublished()).filter(a => a.categoria === cat)
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">{CATEGORY_INFO[cat].label}</h1>
        <p className="text-slate-400">{CATEGORY_INFO[cat].desc}</p>
      </header>
      <CategoryNav active={cat} />
      <ArticleGrid list={list} />
    </div>
  )
}
