'use client'

import { formatBRL, formatDateTime, getStatusColor } from '@/lib/utils'
import { ExternalLink, Package } from 'lucide-react'
import type { Pedido } from '@/lib/types'
import { cn } from '@/lib/utils'

interface OrdersTableProps {
  pedidos: Pedido[]
  isLoading?: boolean
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border capitalize',
      getStatusColor(status)
    )}>
      {status}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-mamba-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  )
}

export default function OrdersTable({ pedidos, isLoading }: OrdersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-mamba-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mamba-border bg-mamba-card">
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">
              Pedido
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">
              Cliente
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase hidden md:table-cell">
              Data/Hora
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">
              Status
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase hidden sm:table-cell">
              Pagamento
            </th>
            <th className="text-right px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

          {!isLoading && pedidos.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <Package className="w-8 h-8 text-mamba-border mx-auto mb-2" />
                <p className="text-sm text-mamba-silver/50">Nenhum pedido encontrado</p>
              </td>
            </tr>
          )}

          {!isLoading && pedidos.map((pedido, idx) => (
            <tr
              key={pedido.id}
              className="border-b border-mamba-border/60 hover:bg-mamba-card/50 transition-colors duration-150"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-mamba-gold">
                    #{pedido.numero || pedido.id}
                  </span>
                  <a
                    href={`https://app.lojaintegrada.com.br/painel/pedidos/${pedido.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mamba-silver/40 hover:text-mamba-gold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-mamba-white text-sm font-medium truncate max-w-[140px] block">
                  {pedido.cliente || '—'}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-mamba-silver text-xs tabular-nums">
                  {pedido.data ? formatDateTime(pedido.data) : '—'}
                </span>
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={pedido.status} />
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <OrderStatusBadge status={pedido.status_pagamento || 'pendente'} />
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-bold text-mamba-white tabular-nums">
                  {formatBRL(parseFloat(pedido.valor_total || '0'))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
