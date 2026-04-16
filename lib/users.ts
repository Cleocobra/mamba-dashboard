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

// ── Upstash Redis (REST, sem pacote extra) ─────────────────────────────────
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const USERS_KEY   = 'mamba_users'

async function redisCmd(cmd: unknown[]): Promise<any> {
  if (!REDIS_URL || !REDIS_TOKEN) return null
  try {
    const res = await fetch(REDIS_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(cmd),
      cache:   'no-store',
    })
    const data = await res.json()
    return data.result ?? null
  } catch {
    return null
  }
}

// ── In-memory cache (por instância serverless) ─────────────────────────────
let _cache: User[] | null = null

async function loadUsers(): Promise<User[]> {
  if (_cache) return _cache

  // 1. Tenta Upstash
  const raw = await redisCmd(['GET', USERS_KEY])
  if (raw) {
    try { _cache = JSON.parse(raw); return _cache! } catch {}
  }

  // 2. Fallback: USERS_JSON env var (compatibilidade)
  const envRaw = process.env.USERS_JSON
  if (envRaw) {
    try {
      const list: User[] = JSON.parse(envRaw)
      if (list.length > 0) { _cache = list; await persist(); return _cache }
    } catch {}
  }

  // 3. Seed admin padrão
  _cache = [{
    id:           'admin-001',
    username:     'mamba',
    passwordHash: bcrypt.hashSync('Mamba@2026*Army', 10),
    role:         'admin',
    permissions:  ['dashboard', 'pedidos', 'fluxo', 'anuncios', 'configuracoes'],
    createdAt:    new Date().toISOString(),
  }]
  await persist()
  return _cache
}

async function persist(): Promise<void> {
  if (!_cache) return
  await redisCmd(['SET', USERS_KEY, JSON.stringify(_cache)])
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export async function getAllUsers(): Promise<SafeUser[]> {
  return (await loadUsers()).map(safe)
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const users = await loadUsers()
  return users.find(u => u.username.toLowerCase() === username.toLowerCase())
}

export async function getUserById(id: string): Promise<User | undefined> {
  return (await loadUsers()).find(u => u.id === id)
}

export async function createUser(data: {
  username:    string
  password:    string
  role:        UserRole
  permissions: Permission[]
}): Promise<SafeUser> {
  const users = await loadUsers()
  if (users.find(u => u.username.toLowerCase() === data.username.toLowerCase()))
    throw new Error('Usuário já existe')

  const user: User = {
    id:           `user-${Date.now()}`,
    username:     data.username.trim(),
    passwordHash: await bcrypt.hash(data.password, 10),
    role:         data.role,
    permissions:  data.permissions,
    createdAt:    new Date().toISOString(),
  }
  _cache = [...users, user]
  await persist()
  return safe(user)
}

export async function updateUser(
  id: string,
  data: { password?: string; role?: UserRole; permissions?: Permission[] }
): Promise<SafeUser | null> {
  const users = await loadUsers()
  const idx   = users.findIndex(u => u.id === id)
  if (idx === -1) return null

  const user = { ...users[idx] }
  if (data.password)    user.passwordHash = await bcrypt.hash(data.password, 10)
  if (data.role)        user.role         = data.role
  if (data.permissions) user.permissions  = data.permissions

  _cache = [...users.slice(0, idx), user, ...users.slice(idx + 1)]
  await persist()
  return safe(user)
}

export async function deleteUser(id: string): Promise<boolean> {
  if (id === 'admin-001') return false
  const users = await loadUsers()
  const next  = users.filter(u => u.id !== id)
  if (next.length === users.length) return false
  _cache = next
  await persist()
  return true
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash)
}

function safe({ passwordHash: _, ...u }: User): SafeUser { return u }
