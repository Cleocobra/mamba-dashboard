import { NextRequest, NextResponse } from 'next/server'

// Inicia o OAuth do Meta: redireciona pro diálogo de login do Facebook.
// Requer META_APP_ID no env. O state anti-CSRF vai num cookie httpOnly.
export async function GET(req: NextRequest) {
  const appId = process.env.META_APP_ID
  if (!appId) {
    return NextResponse.json(
      { error: 'META_APP_ID não configurado no servidor.' },
      { status: 500 }
    )
  }

  const origin      = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const redirectUri = `${origin}/api/meta/oauth/callback`
  const state       = crypto.randomUUID()

  const url = new URL('https://www.facebook.com/v20.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'ads_read')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url)
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600,
    path:     '/',
  })
  return res
}
