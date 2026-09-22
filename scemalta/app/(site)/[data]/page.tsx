import { notFound } from 'next/navigation'
import { getEdition } from '@/lib/store'
import { isValidDate } from '@/lib/pipeline'
import { EditionView } from '../EditionView'

export const dynamic = 'force-dynamic'

export default async function EditionPage({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params
  if (!isValidDate(data)) notFound()
  const edition = await getEdition(data)
  if (!edition || edition.status !== 'published') notFound()
  return <EditionView edition={edition} />
}
