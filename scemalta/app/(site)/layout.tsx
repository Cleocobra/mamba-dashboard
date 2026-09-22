import Link from 'next/link'

// Layout do site público.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ui-accent text-lg font-black text-ui-black">↗</span>
            <span className="text-lg font-black tracking-tight">SC em Alta</span>
          </Link>
          <a href="https://instagram.com/scemalta" target="_blank" rel="noreferrer" className="text-sm font-semibold text-ui-accent hover:underline">
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
