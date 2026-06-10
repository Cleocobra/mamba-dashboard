import { redisExec } from './redis'

// Conexão Meta Ads da instância.
// Prioridade: token/contas salvos via OAuth (Redis) → envs legadas.
// As contas Mamba hardcoded só entram como último fallback da instância
// original (token de env presente e nenhuma conta configurada).

export interface MetaAccount { id: string; name: string }
export interface MetaConn   { token: string | null; accounts: MetaAccount[] }

const TOKEN_KEY    = 'meta_token'
const ACCOUNTS_KEY = 'meta_accounts'

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

  if (!token) token = process.env.META_ACCESS_TOKEN || null

  if (accounts.length === 0 && token) {
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

export async function saveMetaConn(token: string, accounts: MetaAccount[]): Promise<void> {
  await redisExec(['SET', TOKEN_KEY, token])
  await redisExec(['SET', ACCOUNTS_KEY, JSON.stringify(accounts)])
}
