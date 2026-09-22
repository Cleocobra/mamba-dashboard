import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Rotas públicas (sem auth)
const PUBLIC_PATHS = ['/login']
// /api/scemalta/* faz a própria autorização (cookie do painel ou Bearer CRON_SECRET)
const PUBLIC_API   = ['/api/auth/', '/api/scemalta/']
// Site público do SC em Alta (também servido no host SCEMALTA_HOST, ex.: scemalta.com.br)
const SITE_PREFIX  = '/scemalta'
const SITE_HOST    = (process.env.SCEMALTA_HOST || '').toLowerCase()

// Mapa: rota → permissão necessária
const ROUTE_PERM: Record<string, string> = {
  '/':             'dashboard',
  '/pedidos':      'pedidos',
  '/fluxo':        'fluxo',
  '/anuncios':     'anuncios',
  '/produtos':     'produtos',
  '/configuracoes':'configuracoes',
  '/noticias':     'noticias',
}

// Permissão → rota
const PERM_ROUTE: Record<string, string> = {
  dashboard:     '/',
  pedidos:       '/pedidos',
  fluxo:         '/fluxo',
  anuncios:      '/anuncios',
  produtos:      '/produtos',
  configuracoes: '/configuracoes',
  noticias:      '/noticias',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Estáticos e rotas públicas → passa direto
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  // Domínio do SC em Alta: mapeia a raiz do host para o site público (/scemalta/...)
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0]
  if (SITE_HOST && host === SITE_HOST) {
    if (pathname.startsWith('/api/scemalta/')) return NextResponse.next()
    if (!pathname.startsWith(SITE_PREFIX)) {
      const url = req.nextUrl.clone()
      url.pathname = pathname === '/' ? SITE_PREFIX : `${SITE_PREFIX}${pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }
  if (pathname === SITE_PREFIX || pathname.startsWith(SITE_PREFIX + '/')) return NextResponse.next()
  if (PUBLIC_PATHS.includes(pathname))                                   return NextResponse.next()
  if (PUBLIC_API.some(p => pathname.startsWith(p)))                     return NextResponse.next()

  // Verifica token
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const user = await verifyToken(token)
  if (!user) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('mamba_token')
    res.cookies.delete('mamba_info')
    return res
  }

  // Admin acessa tudo
  if (user.role === 'admin') return NextResponse.next()

  // Verifica permissão da página
  const required = ROUTE_PERM[pathname]
  if (required && !user.permissions.includes(required as any)) {
    // Redireciona para primeira página permitida
    const first   = user.permissions[0]
    const redirect = first ? (PERM_ROUTE[first] || '/') : '/login'
    return NextResponse.redirect(new URL(redirect, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
