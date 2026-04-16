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
  purchases: number
  purchase_value: number
}

function parseAction(arr: any[], type: string): number {
  if (!Array.isArray(arr)) return 0
  const found = arr.find((a: any) => a.action_type === type)
  return found ? parseFloat(found.value || '0') : 0
}

async function fetchAccountInsights(accountId: string, accountName: string, datePreset: string) {
  const fields = 'spend,impressions,clicks,cpc,cpm,campaign_name,campaign_id,purchase_roas,actions,action_values'
  const id = accountId.trim()
  const url = `https://graph.facebook.com/${API_VER}/act_${id}/insights?fields=${fields}&date_preset=${datePreset}&level=campaign&access_token=${TOKEN}`
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

async function fetchDailySpend(accountId: string, days: number) {
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]
  const untilStr = new Date().toISOString().split('T')[0]

  const url = `https://graph.facebook.com/${API_VER}/act_${accountId}/insights?fields=spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&access_token=${TOKEN}`
  const res = await fetch(url, { cache: 'no-store' })
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
    const [campaigns1, campaigns2, daily1, daily2] = await Promise.all([
      fetchAccountInsights(ACCOUNT1, 'Mamba 2025', datePreset),
      fetchAccountInsights(ACCOUNT2, 'Mamba Army', datePreset),
      fetchDailySpend(ACCOUNT1, 14),
      fetchDailySpend(ACCOUNT2, 14),
    ])

    const allCampaigns = [...campaigns1, ...campaigns2]
      .sort((a: CampaignInsight, b: CampaignInsight) => b.spend - a.spend)

    // Consolida gastos diários
    const dailyMap: Record<string, number> = {}
    for (const d of [...daily1, ...daily2]) {
      dailyMap[d.data] = (dailyMap[d.data] || 0) + d.gasto
    }
    const daily_combined = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, gasto]) => ({ data, gasto }))

    // Totais por conta — inclui account_name para filtro no front
    const conta1 = {
      account_name: 'Mamba 2025',
      name:         'Mamba 2025',
      spend:        campaigns1.reduce((s: number, c: CampaignInsight) => s + c.spend, 0),
      impressions:  campaigns1.reduce((s: number, c: CampaignInsight) => s + c.impressions, 0),
      clicks:       campaigns1.reduce((s: number, c: CampaignInsight) => s + c.clicks, 0),
      purchases:    campaigns1.reduce((s: number, c: CampaignInsight) => s + c.purchases, 0),
      purchase_value: campaigns1.reduce((s: number, c: CampaignInsight) => s + c.purchase_value, 0),
      campaigns:    campaigns1.length,
    }
    const conta2 = {
      account_name: 'Mamba Army',
      name:         'Mamba Army',
      spend:        campaigns2.reduce((s: number, c: CampaignInsight) => s + c.spend, 0),
      impressions:  campaigns2.reduce((s: number, c: CampaignInsight) => s + c.impressions, 0),
      clicks:       campaigns2.reduce((s: number, c: CampaignInsight) => s + c.clicks, 0),
      purchases:    campaigns2.reduce((s: number, c: CampaignInsight) => s + c.purchases, 0),
      purchase_value: campaigns2.reduce((s: number, c: CampaignInsight) => s + c.purchase_value, 0),
      campaigns:    campaigns2.length,
    }

    return NextResponse.json({
      connected: true,
      data: {
        campaigns:   allCampaigns,
        daily_spend: daily_combined,
        contas:      [conta1, conta2],
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
