export interface Pedido {
  id: number
  numero: string
  data: string
  cliente: string
  status: string
  status_pagamento: string
  valor_total: string
  produtos?: ProdutoPedido[]
}

export interface ProdutoPedido {
  nome: string
  quantidade: number
  preco_venda: string
}

export interface CashFlowEntry {
  data: string
  entradas: number
  saidas: number
  saldo: number
}

export interface MetricCard {
  label: string
  value: string
  change?: number
  changeLabel?: string
  icon?: string
}

export interface MetaAdCampaign {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  cpc: number
  cpm: number
  roas?: number
}

export interface MetaAdsSummary {
  total_spend: number
  total_impressions: number
  total_clicks: number
  avg_cpc: number
  avg_cpm: number
  campaigns: MetaAdCampaign[]
}

export interface DashboardSummary {
  entradas_hoje: number
  saidas_hoje: number
  saldo_hoje: number
  pedidos_hoje: number
  ticket_medio: number
  variacao_entradas: number
  variacao_pedidos: number
  cashflow_semanal: CashFlowEntry[]
  pedidos_recentes: Pedido[]
}
