import { redisExec } from './redis'

// Conexão Meta Ads da instância.
// OAuth salva o token + lista COMPLETA de contas acessíveis (meta_accounts_all);
// as contas que o painel acompanha (meta_accounts) são escolhidas pelo admin —
// com uma conta só, a seleção é automática.

export interface MetaAccount { id: string; name: string }
export interface MetaConn   { token: string | null; accounts: MetaAccount[] }

const TOKEN_KEY        = 'meta_token'
const ACCOUNTS_KEY     = 'meta_accounts'
const ALL_ACCOUNTS_KEY = 'meta_accounts_all'

const LEGACY_ACCOUNTS: Record<string, string> = {
  '1295816082283298': 'Mamba 2025',
  '6791359754274084': 'Mamba Army',
}

export async function getMetaConn(): Promise<MetaConn> {
  let token: string | null = null
  let accounts: MetaAccount[] = []

  try {
    token = await redisExec(['GET', TOKEN_KEY])
    const raw = await redisExec(['GET', ACCOUNTS_KEY])
    if (raw) accounts = JSON.parse(raw)
  } catch {}

  const viaOAuth = !!token
  if (!token) token = process.env.META_ACCESS_TOKEN || null

  // Fallback legado (token fixo via env): contas das envs ou padrão Mamba.
  // Não se aplica a token de OAuth — lá a seleção de contas é explícita.
  if (accounts.length === 0 && token && !viaOAuth) {
    const envIds = [process.env.META_AD_ACCOUNT_1, process.env.META_AD_ACCOUNT_2]
      .filter(Boolean)
      .map(id => String(id).trim())
    const ids = envIds.length > 0 ? envIds : Object.keys(LEGACY_ACCOUNTS)
    accounts = ids.map(id => ({
      id,
      name: LEGACY_ACCOUNTS[id] || `Conta ${id.slice(-4)}`,
    }))
  }

  return { token, accounts }
}

// Pós-OAuth: guarda token e lista completa; auto-seleciona se houver uma só.
export async function saveMetaAuth(token: string, all: MetaAccount[]): Promise<void> {
  await redisExec(['SET', TOKEN_KEY, token])
  await redisExec(['SET', ALL_ACCOUNTS_KEY, JSON.stringify(all)])
  if (all.length === 1) {
    await redisExec(['SET', ACCOUNTS_KEY, JSON.stringify(all)])
  }
}

export async function getAllAccounts(): Promise<MetaAccount[]> {
  try {
    const raw = await redisExec(['GET', ALL_ACCOUNTS_KEY])
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export async function setChosenAccounts(ids: string[]): Promise<MetaAccount[]> {
  const all = await getAllAccounts()
  const chosen = all.filter(a => ids.includes(a.id))
  if (chosen.length > 0) {
    await redisExec(['SET', ACCOUNTS_KEY, JSON.stringify(chosen)])
  }
  return chosen
}

export async function clearChosenAccounts(): Promise<void> {
  await redisExec(['DEL', ACCOUNTS_KEY])
}
