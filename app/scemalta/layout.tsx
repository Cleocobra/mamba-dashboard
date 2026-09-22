import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SC em Alta | O que está em alta em Santa Catarina hoje',
  description: 'Todo dia, as 5 notícias que movem Santa Catarina e as oportunidades para quem empreende no estado.',
}

// Layout do site público (sem sidebar do dashboard). Servido em /scemalta e,
// via SCEMALTA_HOST, na raiz do domínio scemalta.com.br.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/scemalta" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#22C55E] text-lg font-black text-[#0B1220]">↗</span>
            <span className="text-lg font-black tracking-tight">SC em Alta</span>
          </Link>
          <a href="https://instagram.com/scemalta" target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#22C55E] hover:underline">
            @scemalta
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-slate-400">
          Resumos escritos com as nossas palavras a partir de veículos catarinenses, sempre com crédito e link para a fonte.
        </div>
      </footer>
    </div>
  )
}
