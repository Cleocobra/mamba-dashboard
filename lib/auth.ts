import { SignJWT, jwtVerify } from 'jose'

export type Permission = 'dashboard' | 'pedidos' | 'fluxo' | 'anuncios' | 'configuracoes'
export type UserRole   = 'admin' | 'user'

export interface UserPayload {
  id:          string
  username:    string
  role:        UserRole
  permissions: Permission[]
}

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'mamba-army-2026-secret-key-change-in-prod'
  )

export async function signToken(payload: UserPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return {
      id:          payload.id          as string,
      username:    payload.username    as string,
      role:        payload.role        as UserRole,
      permissions: payload.permissions as Permission[],
    }
  } catch {
    return null
  }
}
