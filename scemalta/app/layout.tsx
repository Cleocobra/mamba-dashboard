import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SC em Alta | O que está em alta em Santa Catarina hoje',
  description: 'Todo dia, as 5 notícias que movem Santa Catarina e as oportunidades para quem empreende no estado.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-ui-black text-ui-white font-sans antialiased">{children}</body>
    </html>
  )
}
