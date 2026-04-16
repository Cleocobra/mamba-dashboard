import { NextRequest, NextResponse } from 'next/server'

const TOKEN    = process.env.META_ACCESS_TOKEN
const ACCOUNT1 = process.env.META_AD_ACCOUNT_1 || '1295816082283298'
const ACCOUNT2 = process.env.META_AD_ACCOUNT_2 || '6791359754274084'
const API_VER  = 'v20.0'

const ACCOUNT_NAMES: Record<string, string> = {
  '1295816082283298': 'Mamba 2025',
  '6791359754274084': 'Mamba Army',
}

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
}

async function fetchAccountInsights(accountId: string, datePreset: string) {
  const fields = 'spend,impressions,clicks,cpc,cpm,campaign_name,campaign_id,purchase_roas'
  const url = `https://graph.facebook.com/${API_VER}/act_${accountId}/insights?fields=${fields}&date_preset=${datePreset}&level=campaign&access_token=${TOKEN}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Meta API ${res.status}`)
  }
  const data = await res.json()
  return (data.data || []).map((item: any): CampaignInsight => ({
    campaign_id:   item.campaign_id   || '',
    campaign_name: item.campaign_name || '—',
    account_id:    accountId,
    account_name:  ACCOUNT_NAMES[accountId] || accountId,
    status:        'ACTIVE',
    spend:         parseFloat(item.spend       || '0'),
    impressions:   parseInt(item.impressions   || '0'),
    clicks:        parseInt(item.clicks        || '0'),
    cpc:           parseFloat(item.cpc         || '0'),
    cpm:           parseFloat(item.cpm         || '0'),
    roas:          item.purchase_roas?.[0]?.value ? parseFloat(item.purchase_roas[0].value) : 0,
  }))
}

async function fetchDailySpend(accountId: string, days: number) {
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]
  const untilStr = new Date().toISOString().split('T')[0]

  const url = `https://graph.facebook.com/${API_VER}/act_${accountId}/insights?fields=spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&access_token=${TOKEN}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data || []).map((d: any) => ({
    data:  d.date_start,
    gasto: parseFloat(d.spend || '0'),
  }))
}

export async function GET(request: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ connected: false, error: 'META_ACCESS_TOKEN não configurado.' })
  }

  const { searchParams } = new URL(request.url)
  const datePreset = searchParams.get('preset') || 'last_7d'

  try {
    // Busca dados das 2 contas em paralelo
    const [campaigns1, campaigns2, daily1, daily2] = await Promise.all([
      fetchAccountInsights(ACCOUNT1, datePreset),
      fetchAccountInsights(ACCOUNT2, datePreset),
      fetchDailySpend(ACCOUNT1, 14),
      fetchDailySpend(ACCOUNT2, 14),
    ])

    const allCampaigns = [...campaigns1, ...campaigns2]
      .sort((a, b) => b.spend - a.spend) // ordena por gasto desc

    // Consolida gastos diários das 2 contas
    const dailyMap: Record<string, number> = {}
    for (const d of [...daily1, ...daily2]) {
      dailyMap[d.data] = (dailyMap[d.data] || 0) + d.gasto
    }
    const daily_combined = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, gasto]) => ({ data, gasto }))

    // Totais globais
    const total_spend       = allCampaigns.reduce((s: number, c: CampaignInsight) => s + c.spend, 0)
    const total_impressions = allCampaigns.reduce((s: number, c: CampaignInsight) => s + c.impressions, 0)
    const total_clicks      = allCampaigns.reduce((s: number, c: CampaignInsight) => s + c.clicks, 0)
    const avg_cpc           = total_clicks > 0 ? total_spend / total_clicks : 0
    const avg_cpm           = total_impressions > 0 ? (total_spend / total_impressions) * 1000 : 0
    const avg_roas          = allCampaigns.filter((c: CampaignInsight) => c.roas > 0).reduce((s: number, c: CampaignInsight) => s + c.roas, 0) /
                              (allCampaigns.filter((c: CampaignInsight) => c.roas > 0).length || 1)

    // Totais por conta
    const conta1 = {
      name: ACCOUNT_NAMES[ACCOUNT1],
      spend:       campaigns1.reduce((s: number, c: CampaignInsight) => s + c.spend, 0),
      impressions: campaigns1.reduce((s: number, c: CampaignInsight) => s + c.impressions, 0),
      clicks:      campaigns1.reduce((s: number, c: CampaignInsight) => s + c.clicks, 0),
      campaigns:   campaigns1.length,
    }
    const conta2 = {
      name: ACCOUNT_NAMES[ACCOUNT2],
      spend:       campaigns2.reduce((s: number, c: CampaignInsight) => s + c.spend, 0),
      impressions: campaigns2.reduce((s: number, c: CampaignInsight) => s + c.impressions, 0),
      clicks:      campaigns2.reduce((s: number, c: CampaignInsight) => s + c.clicks, 0),
      campaigns:   campaigns2.length,
    }

    return NextResponse.json({
      connected: true,
      data: {
        total_spend,
        total_impressions,
        total_clicks,
        avg_cpc,
        avg_cpm,
        avg_roas,
        campaigns: allCampaigns,
        daily_spend: daily_combined,
        contas: [conta1, conta2],
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
