import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getAllUsers, createUser, updateUser, deleteUser } from '@/lib/users'

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  if (!token) return null
  const user = await verifyToken(token)
  return user?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  return NextResponse.json({ users: getAllUsers() })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  try {
    const body = await req.json()
    const user = await createUser(body)
    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const { id, ...data } = await req.json()
  const user = await updateUser(id, data)
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const { id } = await req.json()
  const ok = await deleteUser(id)
  if (!ok) return NextResponse.json({ error: 'Não foi possível deletar' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
