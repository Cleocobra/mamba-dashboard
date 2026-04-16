import { cn, formatBRL, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  isCurrency?: boolean
  change?: number
  changeLabel?: string
  icon: LucideIcon
  iconColor?: string
  accentColor?: 'gold' | 'green' | 'red' | 'blue' | 'default'
  className?: string
  animationDelay?: string
}

const accentMap = {
  gold:    { bg: 'bg-mamba-gold/10', icon: 'text-mamba-gold', border: 'border-mamba-gold/20' },
  green:   { bg: 'bg-green-400/10',  icon: 'text-green-400',  border: 'border-green-400/20'  },
  red:     { bg: 'bg-red-400/10',    icon: 'text-red-400',    border: 'border-red-400/20'    },
  blue:    { bg: 'bg-blue-400/10',   icon: 'text-blue-400',   border: 'border-blue-400/20'   },
  default: { bg: 'bg-mamba-border/40', icon: 'text-mamba-silver', border: 'border-mamba-border' },
}

export default function MetricCard({
  label,
  value,
  isCurrency = false,
  change,
  changeLabel,
  icon: Icon,
  accentColor = 'default',
  className,
  animationDelay,
}: MetricCardProps) {
  const accent = accentMap[accentColor]
  const displayValue = isCurrency && typeof value === 'number'
    ? formatBRL(value)
    : value

  const TrendIcon = change === undefined ? null
    : change > 0 ? TrendingUp
    : change < 0 ? TrendingDown
    : Minus

  const trendColor = change === undefined ? ''
    : change > 0 ? 'text-green-400'
    : change < 0 ? 'text-red-400'
    : 'text-mamba-silver'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-mamba-border bg-mamba-card p-5 card-hover animate-fade-in-up',
        className
      )}
      style={animationDelay ? { animationDelay } : undefined}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold tracking-wider text-mamba-silver uppercase">{label}</p>
        <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg border', accent.bg, accent.border)}>
          <Icon className={cn('w-4.5 h-4.5', accent.icon)} strokeWidth={2} />
        </div>
      </div>

      {/* Value */}
      <p className="text-2xl font-black text-mamba-white tracking-tight tabular-nums">
        {displayValue}
      </p>

      {/* Trend */}
      {(change !== undefined || changeLabel) && (
        <div className={cn('flex items-center gap-1.5 mt-2', trendColor)}>
          {TrendIcon && <TrendIcon className="w-3.5 h-3.5 flex-shrink-0" />}
          {change !== undefined && (
            <span className="text-xs font-semibold">{formatPercent(change)}</span>
          )}
          {changeLabel && (
            <span className="text-xs text-mamba-silver/60">{changeLabel}</span>
          )}
        </div>
      )}

      {/* Decorative corner */}
      <div className={cn(
        'absolute -bottom-3 -right-3 w-16 h-16 rounded-full opacity-10',
        accent.bg.replace('/10', '/30')
      )} />
    </div>
  )
}
