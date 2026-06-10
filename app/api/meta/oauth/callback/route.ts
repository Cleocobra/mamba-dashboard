import { NextRequest, NextResponse } from 'next/server'
import { saveMetaConn } from '@/lib/meta'

const API_VER = 'v20.0'

// Callback do OAuth Meta: troca code → token curto → token longo (60 dias),
// busca as contas de anúncio do usuário e persiste tudo no Redis.
export async function GET(req: NextRequest) {
  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const origin    = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const back      = (q: string) => NextResponse.redirect(`${origin}/anuncios?${q}`)

  if (!appId || !appSecret) {
    return back('meta_error=' + encodeURIComponent('META_APP_ID/META_APP_SECRET não configurados no servidor'))
  }

  const sp     = req.nextUrl.searchParams
  const code   = sp.get('code')
  const state  = sp.get('state')
  const saved  = req.cookies.get('meta_oauth_state')?.value
  const fbErr  = sp.get('error_description') || sp.get('error')

  if (fbErr)                                  return back('meta_error=' + encodeURIComponent(fbErr))
  if (!code || !state || state !== saved)     return back('meta_error=' + encodeURIComponent('Sessão OAuth inválida — tente novamente'))

  const redirectUri = `${origin}/api/meta/oauth/callback`

  try {
    // 1. code → token curto
    const r1 = await fetch(
      `https://graph.facebook.com/${API_VER}/oauth/access_token` +
      `?client_id=${appId}&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
      { cache: 'no-store' }
    )
    const d1 = await r1.json()
    if (!d1.access_token) throw new Error(d1.error?.message || 'Falha ao obter access token')

    // 2. token curto → longo (≈60 dias)
    const r2 = await fetch(
      `https://graph.facebook.com/${API_VER}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${d1.access_token}`,
      { cache: 'no-store' }
    )
    const d2    = await r2.json()
    const token = d2.access_token || d1.access_token

    // 3. contas de anúncio acessíveis
    const r3 = await fetch(
      `https://graph.facebook.com/${API_VER}/me/adaccounts` +
      `?fields=name,account_id&limit=50&access_token=${token}`,
      { cache: 'no-store' }
    )
    const d3 = await r3.json()
    if (d3.error) throw new Error(d3.error.message)
    const accounts = (d3.data || []).map((a: any) => ({
      id:   String(a.account_id),
      name: a.name || `Conta ${a.account_id}`,
    }))
    if (accounts.length === 0) throw new Error('Nenhuma conta de anúncios encontrada para este usuário')

    await saveMetaConn(token, accounts)

    const res = back('meta_connected=1')
    res.cookies.delete('meta_oauth_state')
    return res
  } catch (e: any) {
    return back('meta_error=' + encodeURIComponent(String(e?.message || e)))
  }
}
