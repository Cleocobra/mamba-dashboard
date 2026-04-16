'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import Image from 'next/image'
import {
  LayoutDashboard, ShoppingBag, Megaphone,
  TrendingUp, Settings, ChevronRight, LogOut, X,
} from 'lucide-react'
import type { UserPayload } from '@/lib/auth'

const ALL_NAV = [
  { label: 'Dashboard',      href: '/',             icon: LayoutDashboard, perm: 'dashboard'     },
  { label: 'Pedidos',        href: '/pedidos',       icon: ShoppingBag,     perm: 'pedidos'       },
  { label: 'Fluxo de Caixa', href: '/fluxo',         icon: TrendingUp,      perm: 'fluxo'         },
  { label: 'Meta Ads',       href: '/anuncios',      icon: Megaphone,       perm: 'anuncios'      },
  { label: 'Configurações',  href: '/configuracoes', icon: Settings,        perm: 'configuracoes' },
]

function readUserCookie(): UserPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const match = document.cookie.match(/(?:^|;\s*)mamba_info=([^;]*)/)
    if (!match) return null
    return JSON.parse(decodeURIComponent(match[1]))
  } catch { return null }
}

export default function Sidebar() {
  const pathname         = usePathname()
  const router           = useRouter()
  const { isOpen, closeSidebar } = useSidebar()
  const [user, setUser]  = useState<UserPayload | null>(null)

  useEffect(() => { setUser(readUserCookie()) }, [])

  const navItems = ALL_NAV.filter(item =>
    !user || user.role === 'admin' || user.permissions.includes(item.perm as any)
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const handleNavClick = () => closeSidebar()

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'MA'

  return (
    <>
      {/* ── Backdrop mobile ─────────────────────────────────────────────── */}
      <div
        onClick={closeSidebar}
        className={cn(
          'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-mamba-dark border-r border-mamba-border',
        'transition-transform duration-300 ease-in-out',
        // Mobile: slide in/out | Desktop: always visible
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mamba-border">
          <Image
            src="/logo-mamba.png"
            alt="Mamba Army"
            width={148}
            height={34}
            priority
            className="object-contain"
          />
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px] bg-mamba-gold/10 text-mamba-gold border border-mamba-gold/20 px-2 py-0.5 rounded font-mono font-bold tracking-wider flex-shrink-0">
              OPS
            </span>
            {/* Botão fechar no mobile */}
            <button onClick={closeSidebar} className="md:hidden p-1 text-mamba-silver/60 hover:text-mamba-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-bold tracking-[0.2em] text-mamba-silver/50 uppercase px-3 mb-3">
            Operações
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon     = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-mamba-gold text-mamba-black'
                    : 'text-mamba-silver hover:text-mamba-white hover:bg-mamba-card'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-mamba-black' : '')} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-mamba-black/60" />}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-4 py-4 border-t border-mamba-border space-y-2">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-mamba-card">
            <div className="w-7 h-7 rounded-full bg-mamba-gold/20 border border-mamba-gold/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-mamba-gold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-mamba-white truncate">{user?.username || '...'}</p>
              <p className="text-[10px] text-mamba-silver/60 truncate">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-mamba-silver/60 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
