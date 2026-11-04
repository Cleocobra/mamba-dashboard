import Link from 'next/link'
import { BRAND } from '@/lib/brand'

// Layout do site público.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-1">
        <span className="flex-1 bg-ui-accent" /><span className="flex-1 bg-ui-pink" /><span className="flex-1 bg-ui-yellow" /><span className="flex-1 bg-ui-white" />
      </div>
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 items-center justify-center rounded-lg bg-ui-accent px-2 text-sm font-black tracking-wide text-ui-black">{BRAND.logoMark}</span>
            <span className="text-lg font-black tracking-tight">{BRAND.name}</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-semibold text-slate-300">
            <Link href="/tutoriais" className="hover:text-ui-accent">Tutoriais</Link>
            <Link href="/ferramentas" className="hover:text-ui-accent">Ferramentas</Link>
            <Link href="/solucoes" className="rounded-lg bg-ui-accent/10 px-3 py-1.5 text-ui-accent hover:bg-ui-accent/20">Soluções</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:justify-between">
          <p>{BRAND.name} · {BRAND.tagline}</p>
          <p>Parâmetros são faixas de referência: confirme sempre com a ficha técnica do seu filme e pó.</p>
          <a href={`https://instagram.com/${BRAND.instagram}`} target="_blank" rel="noreferrer" className="font-semibold text-ui-accent hover:underline">@{BRAND.instagram}</a>
        </div>
      </footer>
    </div>
  )
}
