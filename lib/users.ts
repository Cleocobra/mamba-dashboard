import bcrypt from 'bcryptjs'
import type { Permission, UserRole } from './auth'

export interface User {
  id:           string
  username:     string
  passwordHash: string
  role:         UserRole
  permissions:  Permission[]
  createdAt:    string
}

export type SafeUser = Omit<User, 'passwordHash'>

// ── In-memory store ────────────────────────────────────────────────────────
let store: Map<string, User> | null = null

function getStore(): Map<string, User> {
  if (store) return store
  store = new Map()

  // Load from env var (written by Vercel API after each change)
  const raw = process.env.USERS_JSON
  if (raw) {
    try {
      const list: User[] = JSON.parse(raw)
      if (list.length > 0) {
        list.forEach(u => store!.set(u.id, u))
        return store
      }
    } catch { /* ignore */ }
  }

  // Seed default admin
  const hash = bcrypt.hashSync('Mamba@2026*Army', 10)
  const admin: User = {
    id:           'admin-001',
    username:     'mamba',
    passwordHash: hash,
    role:         'admin',
    permissions:  ['dashboard', 'pedidos', 'fluxo', 'anuncios', 'configuracoes'],
    createdAt:    new Date().toISOString(),
  }
  store.set(admin.id, admin)
  persistToVercel().catch(() => {})
  return store
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export function getAllUsers(): SafeUser[] {
  return Array.from(getStore().values()).map(safe)
}

export function getUserByUsername(username: string): User | undefined {
  return Array.from(getStore().values())
    .find(u => u.username.toLowerCase() === username.toLowerCase())
}

export function getUserById(id: string): User | undefined {
  return getStore().get(id)
}

export async function createUser(data: {
  username:    string
  password:    string
  role:        UserRole
  permissions: Permission[]
}): Promise<SafeUser> {
  const s = getStore()
  if (Array.from(s.values()).find(u => u.username.toLowerCase() === data.username.toLowerCase())) {
    throw new Error('Usuário já existe')
  }
  const user: User = {
    id:           `user-${Date.now()}`,
    username:     data.username.trim(),
    passwordHash: await bcrypt.hash(data.password, 10),
    role:         data.role,
    permissions:  data.permissions,
    createdAt:    new Date().toISOString(),
  }
  s.set(user.id, user)
  await persistToVercel()
  return safe(user)
}

export async function updateUser(
  id: string,
  data: { password?: string; role?: UserRole; permissions?: Permission[] }
): Promise<SafeUser | null> {
  const s    = getStore()
  const user = s.get(id)
  if (!user) return null
  if (data.password)    user.passwordHash = await bcrypt.hash(data.password, 10)
  if (data.role)        user.role         = data.role
  if (data.permissions) user.permissions  = data.permissions
  s.set(id, user)
  await persistToVercel()
  return safe(user)
}

export async function deleteUser(id: string): Promise<boolean> {
  if (id === 'admin-001') return false   // admin principal nunca pode ser deletado
  const ok = getStore().delete(id)
  if (ok) await persistToVercel()
  return ok
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash)
}

// ── Helpers ────────────────────────────────────────────────────────────────
function safe({ passwordHash: _, ...u }: User): SafeUser { return u }

// ── Persist via Vercel API ─────────────────────────────────────────────────
async function persistToVercel() {
  const token     = process.env.VERCEL_DEPLOY_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId    = process.env.VERCEL_TEAM_ID
  if (!token || !projectId) return

  const value = JSON.stringify(Array.from(getStore().values()))
  const qs    = teamId ? `?teamId=${teamId}` : ''

  try {
    const list    = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    const existing = list.envs?.find((e: any) => e.key === 'USERS_JSON')

    if (existing) {
      await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}${qs}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ value }),
      })
    } else {
      await fetch(`https://api.vercel.com/v9/projects/${projectId}/env${qs}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          key: 'USERS_JSON', value,
          type: 'encrypted',
          target: ['production', 'preview', 'development'],
        }),
      })
    }
  } catch { /* silent – in-memory changes still apply */ }
}
