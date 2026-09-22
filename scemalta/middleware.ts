import { NextRequest, NextResponse } from 'next/server'

// Protege o painel (/admin) e a API (/api/*, exceto as imagens públicas dos cards).
// Aceita: Bearer CRON_SECRET (agendador/cron) ou login básico ADMIN_USER/ADMIN_PASSWORD.
function isProtected(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  return pathname.startsWith('/api/') && !pathname.startsWith('/api/img/')
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!isProtected(pathname)) return NextResponse.next()

  const auth   = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (secret && auth === `Bearer ${secret}`) return NextResponse.next()

  const user = process.env.ADMIN_USER || 'admin'
  const pass = process.env.ADMIN_PASSWORD
  if (pass && auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6))
      const i = decoded.indexOf(':')
      if (i > 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) return NextResponse.next()
    } catch { /* cabeçalho inválido */ }
  }
  return new NextResponse('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SC em Alta", charset="UTF-8"' },
  })
}

export const config = { matcher: ['/admin', '/admin/:path*', '/api/:path*'] }
