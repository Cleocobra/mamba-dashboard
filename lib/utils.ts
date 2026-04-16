import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    aprovado: 'text-green-400 bg-green-400/10 border-green-400/20',
    pago: 'text-green-400 bg-green-400/10 border-green-400/20',
    enviado: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    entregue: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    cancelado: 'text-red-400 bg-red-400/10 border-red-400/20',
    pendente: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    aguardando: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  }
  const lower = status.toLowerCase()
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val
  }
  return 'text-mamba-silver bg-mamba-border/40 border-mamba-border'
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

export function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}
