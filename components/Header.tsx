'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, RefreshCw, Calendar, Menu } from 'lucide-react'
import { useSidebar } from '@/context/SidebarContext'

interface HeaderProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export default function Header({ title, subtitle, onRefresh, isRefreshing }: HeaderProps) {
  const today = format(new Date(), "EEE, dd 'de' MMM", { locale: ptBR })
  const { toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 py-3.5 bg-mamba-black/80 backdrop-blur-md border-b border-mamba-border">

      {/* Hamburguer — só mobile */}
      <button
        onClick={toggleSidebar}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-mamba-card border border-mamba-border text-mamba-silver hover:text-mamba-white transition-colors cursor-pointer flex-shrink-0"
        aria-label="Abrir menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-lg font-black tracking-tight text-mamba-white truncate">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-mamba-silver mt-0.5 truncate">{subtitle}</p>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3 text-mamba-silver/60" />
            <p className="text-xs text-mamba-silver/60 capitalize">{today}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-2 text-xs font-medium text-mamba-silver hover:text-mamba-white bg-mamba-card hover:bg-mamba-border border border-mamba-border rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        )}
        <button className="relative p-2 text-mamba-silver hover:text-mamba-white bg-mamba-card hover:bg-mamba-border border border-mamba-border rounded-lg transition-all duration-200 cursor-pointer">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-mamba-gold rounded-full" />
        </button>
      </div>
    </header>
  )
}
