import type { Metadata } from 'next'
import { BRAND, publicBaseUrl } from '@/lib/brand'
import './globals.css'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(publicBaseUrl()),
    title: { default: `${BRAND.name} | ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
    description: 'Tutoriais práticos de DTF e estamparia: preparo de arte, impressão, pó, cura, prensagem por tecido, problemas e soluções, precificação e gang sheet.',
    openGraph: { siteName: BRAND.name, locale: 'pt_BR', type: 'website' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-ui-black text-ui-white font-sans antialiased">{children}</body>
    </html>
  )
}
