import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mamba Army | Dashboard',
  description: 'Painel de controle Mamba Army — Fluxo de Caixa, Pedidos e Anúncios',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-mamba-black min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
