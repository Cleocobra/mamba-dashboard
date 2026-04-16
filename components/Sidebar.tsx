'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingBag,
  Megaphone,
  TrendingUp,
  Settings,
  ChevronRight,
  Crosshair,
} from 'lucide-react'

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Pedidos',
    href: '/pedidos',
    icon: ShoppingBag,
  },
  {
    label: 'Fluxo de Caixa',
    href: '/fluxo',
    icon: TrendingUp,
  },
  {
    label: 'Meta Ads',
    href: '/anuncios',
    icon: Megaphone,
  },
  {
    label: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-mamba-dark border-r border-mamba-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-mamba-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-mamba-gold">
          <Crosshair className="w-5 h-5 text-mamba-black" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-black tracking-widest text-mamba-gold uppercase leading-none">MAMBA</p>
          <p className="text-[10px] tracking-[0.3em] text-mamba-silver uppercase leading-none mt-0.5">ARMY</p>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] bg-mamba-gold/10 text-mamba-gold border border-mamba-gold/20 px-2 py-0.5 rounded font-mono font-bold tracking-wider">
            OPS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase px-3 mb-3">
          Operações
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-mamba-gold text-mamba-black'
                  : 'text-mamba-silver hover:text-mamba-white hover:bg-mamba-card'
              )}
            >
              <Icon
                className={cn('w-4.5 h-4.5 flex-shrink-0', isActive ? 'text-mamba-black' : '')}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-mamba-black/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-mamba-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-mamba-card">
          <div className="w-7 h-7 rounded-full bg-mamba-gold/20 border border-mamba-gold/30 flex items-center justify-center">
            <span className="text-xs font-bold text-mamba-gold">MA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-mamba-white truncate">Mamba Army</p>
            <p className="text-[10px] text-mamba-silver/60 truncate">Painel Operacional</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="Online" />
        </div>
      </div>
    </aside>
  )
}
