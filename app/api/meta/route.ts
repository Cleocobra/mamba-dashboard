import { NextRequest, NextResponse } from 'next/server'
import { getMetaConn, getAllAccounts, type MetaAccount } from '@/lib/meta'

const API_VER = 'v20.0'

interface CampaignInsight {
  campaign_id: string
  campaign_name: string
  account_id: string
  account_name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  cpc: number
  cpm: number
  roas: number
  purchases: number
  purchase_value: number
}

function parseAction(arr: any[], type: string): number {
  if (!Array.isArray(arr)) return 0
  const found = arr.find((a: any) => a.action_type === type)
  return found ? parseFloat(found.value || '0') : 0
}

async function fetchAccountInsights(token: string, accountId: string, accountName: string, datePreset: string) {
  const fields = 'spend,impressions,clicks,cpc,cpm,campaign_name,campaign_id,purchase_roas,actions,action_values'
  const id = accountId.trim()
  const url = `https://graph.facebook.com/${API_VER}/act_${id}/insights?fields=${fields}&date_preset=${datePreset}&level=campaign&access_token=${token}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Meta API ${res.status}`)
  }
  const data = await res.json()
  return (data.data || []).map((item: any): CampaignInsight => ({
    campaign_id:    item.campaign_id   || '',
    campaign_name:  item.campaign_name || '—',
    account_id:     id,
    account_name:   accountName,          // nome explícito, sem lookup por ID
    status:         'ACTIVE',
    spend:          parseFloat(item.spend       || '0'),
    impressions:    parseInt(item.impressions   || '0'),
    clicks:         parseInt(item.clicks        || '0'),
    cpc:            parseFloat(item.cpc         || '0'),
    cpm:            parseFloat(item.cpm         || '0'),
    roas:           item.purchase_roas?.[0]?.value ? parseFloat(item.purchase_roas[0].value) : 0,
    purchases:      parseAction(item.actions,       'purchase') ||
                    parseAction(item.actions,       'offsite_conversion.fb_pixel_purchase'),
    purchase_value: parseAction(item.action_values, 'purchase') ||
                    parseAction(item.action_values, 'offsite_conversion.fb_pixel_purchase'),
  }))
}

async function fetchDailySpend(token: string, accountId: string, days: number) {
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]
  const untilStr = new Date().toISOString().split('T')[0]

  const url = `https://graph.facebook.com/${API_VER}/act_${accountId.trim()}/insights?fields=spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&access_token=${token}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data || []).map((d: any) => ({
    data:  d.date_start,
    gasto: parseFloat(d.spend || '0'),
  }))
}

function consolidaConta(account: MetaAccount, campaigns: CampaignInsight[]) {
  return {
    id:             account.id,
    account_name:   account.name,
    name:           account.name,
    spend:          campaigns.reduce((s, c) => s + c.spend, 0),
    impressions:    campaigns.reduce((s, c) => s + c.impressions, 0),
    clicks:         campaigns.reduce((s, c) => s + c.clicks, 0),
    purchases:      campaigns.reduce((s, c) => s + c.purchases, 0),
    purchase_value: campaigns.reduce((s, c) => s + c.purchase_value, 0),
    campaigns:      campaigns.length,
  }
}

export async function GET(request: NextRequest) {
  const { token, accounts } = await getMetaConn()
  if (!token) {
    return NextResponse.json({ connected: false, needs_oauth: true, error: 'Conta Meta não conectada.' })
  }
  if (accounts.length === 0) {
    // Token OK mas contas ainda não escolhidas → painel mostra o seletor
    const accounts_all = await getAllAccounts()
    if (accounts_all.length > 0) {
      return NextResponse.json({ connected: false, needs_selection: true, accounts_all })
    }
    return NextResponse.json({ connected: false, needs_oauth: true, error: 'Conta Meta não conectada.' })
  }

  const { searchParams } = new URL(request.url)
  const datePreset = searchParams.get('preset') || 'last_7d'

  try {
    const [porConta, porContaDaily] = await Promise.all([
      Promise.all(accounts.map(a => fetchAccountInsights(token, a.id, a.name, datePreset))),
      Promise.all(accounts.map(a => fetchDailySpend(token, a.id, 14))),
    ])

    const allCampaigns = porConta.flat()
      .sort((a: CampaignInsight, b: CampaignInsight) => b.spend - a.spend)

    // Consolida gastos diários de todas as contas
    const dailyMap: Record<string, number> = {}
    for (const d of porContaDaily.flat()) {
      dailyMap[d.data] = (dailyMap[d.data] || 0) + d.gasto
    }
    const daily_combined = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, gasto]) => ({ data, gasto }))

    return NextResponse.json({
      connected: true,
      data: {
        campaigns:   allCampaigns,
        daily_spend: daily_combined,
        contas:      accounts.map((a, i) => consolidaConta(a, porConta[i])),
        date_preset: datePreset,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: String(error) },
      { status: 500 }
    )
  }
}
