import type { Metadata } from 'next'
import './globals.css'
import { SidebarProvider } from '@/context/SidebarContext'
import { STORE_NAME } from '@/lib/branding'

export const metadata: Metadata = {
  title: `${STORE_NAME} | Dashboard`,
  description: `Painel de controle ${STORE_NAME} — Fluxo de Caixa, Pedidos e Anúncios`,
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
        <SidebarProvider>{children}</SidebarProvider>
      </body>
    </html>
  )
}
