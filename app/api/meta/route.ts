import { NextRequest, NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID

export async function GET(request: NextRequest) {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return NextResponse.json(
      { connected: false, error: 'Meta Ads não configurado. Adicione META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no .env' },
      { status: 200 }
    )
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since') || getDateDaysAgo(7)
  const until = searchParams.get('until') || getTodayDate()

  try {
    const fields = 'spend,impressions,clicks,cpc,cpm,campaign_name,campaign_id,objective'
    const url = `https://graph.facebook.com/v20.0/act_${META_AD_ACCOUNT_ID}/insights?` +
      `fields=${fields}&time_range={"since":"${since}","until":"${until}"}` +
      `&level=campaign&access_token=${META_ACCESS_TOKEN}`

    const res = await fetch(url, { next: { revalidate: 300 } })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `Meta API error: ${res.status}`)
    }

    const metaData = await res.json()
    const items = metaData.data || []

    const campaigns = items.map((item: any) => ({
      id: item.campaign_id,
      name: item.campaign_name,
      status: 'ACTIVE',
      spend: parseFloat(item.spend || '0'),
      impressions: parseInt(item.impressions || '0'),
      clicks: parseInt(item.clicks || '0'),
      cpc: parseFloat(item.cpc || '0'),
      cpm: parseFloat(item.cpm || '0'),
    }))

    const total_spend = campaigns.reduce((a: number, c: any) => a + c.spend, 0)
    const total_impressions = campaigns.reduce((a: number, c: any) => a + c.impressions, 0)
    const total_clicks = campaigns.reduce((a: number, c: any) => a + c.clicks, 0)
    const avg_cpc = total_clicks > 0 ? total_spend / total_clicks : 0
    const avg_cpm = total_impressions > 0 ? (total_spend / total_impressions) * 1000 : 0

    return NextResponse.json({
      connected: true,
      data: {
        total_spend,
        total_impressions,
        total_clicks,
        avg_cpc,
        avg_cpm,
        campaigns,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: String(error) },
      { status: 500 }
    )
  }
}

function getDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}
