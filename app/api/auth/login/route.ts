import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, verifyPassword } from '@/lib/users'
import { signToken } from '@/lib/auth'

const COOKIE_OPTS = {
  httpOnly: false,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   60 * 60 * 24 * 7, // 7 dias
  path:     '/',
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password)
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })

  const user = await getUserByUsername(username)
  if (!user || !(await verifyPassword(user, password)))
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })

  const payload = {
    id:          user.id,
    username:    user.username,
    role:        user.role,
    permissions: user.permissions,
  }
  const token = await signToken(payload)

  const res = NextResponse.json({ ok: true, user: payload })

  // Token httpOnly para verificação no middleware
  res.cookies.set('mamba_token', token, { ...COOKIE_OPTS, httpOnly: true })
  // Info legível para componentes cliente (sem senha)
  res.cookies.set('mamba_info', JSON.stringify(payload), COOKIE_OPTS)

  return res
}
