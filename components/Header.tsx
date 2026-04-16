'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, RefreshCw, Calendar } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export default function Header({ title, subtitle, onRefresh, isRefreshing }: HeaderProps) {
  const today = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-mamba-black/80 backdrop-blur-md border-b border-mamba-border">
      <div>
        <h1 className="text-lg font-black tracking-tight text-mamba-white">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-mamba-silver mt-0.5">{subtitle}</p>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3 text-mamba-silver/60" />
            <p className="text-xs text-mamba-silver/60 capitalize">{today}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-mamba-silver hover:text-mamba-white bg-mamba-card hover:bg-mamba-border border border-mamba-border rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Atualizar
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
