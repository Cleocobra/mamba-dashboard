'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import {
  Users, Plus, Trash2, Pencil, Check, X,
  Key, ExternalLink, CheckCircle, AlertCircle, Copy, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
type Permission = 'dashboard' | 'pedidos' | 'fluxo' | 'anuncios' | 'configuracoes' | 'produtos'
interface SafeUser {
  id: string; username: string; role: string
  permissions: Permission[]; createdAt: string
}

const PERMS: { key: Permission; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard'        },
  { key: 'pedidos',       label: 'Pedidos'          },
  { key: 'produtos',      label: 'Produtos Vendidos'},
  { key: 'fluxo',         label: 'Fluxo de Caixa'  },
  { key: 'anuncios',      label: 'Meta Ads'         },
  { key: 'configuracoes', label: 'Configurações'    },
]

// ── Copy button helper ─────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000) }}
      className="p-1.5 rounded-md hover:bg-mamba-border transition-colors cursor-pointer text-mamba-silver/50 hover:text-mamba-silver">
      {done ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Permission checkbox row ────────────────────────────────────────────────
function PermCheckbox({ perm, checked, onChange }: { perm: Permission; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div onClick={() => onChange(!checked)}
        className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer',
          checked ? 'bg-mamba-gold border-mamba-gold' : 'border-mamba-border bg-mamba-black group-hover:border-mamba-silver/40')}>
        {checked && <Check className="w-2.5 h-2.5 text-mamba-black" strokeWidth={3} />}
      </div>
      <span className="text-xs text-mamba-silver">{PERMS.find(p => p.key === perm)?.label}</span>
    </label>
  )
}

// ── New / Edit user form ───────────────────────────────────────────────────
function UserForm({
  initial, onSave, onCancel,
}: {
  initial?: SafeUser
  onSave: (data: { username: string; password: string; permissions: Permission[] }) => void
  onCancel: () => void
}) {
  const [username, setUsername]     = useState(initial?.username || '')
  const [password, setPassword]     = useState('')
  const [perms,    setPerms]        = useState<Permission[]>(initial?.permissions || [])
  const [saving,   setSaving]       = useState(false)

  const toggle = (p: Permission) =>
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const handleSave = async () => {
    if (!username.trim()) return
    if (!initial && !password.trim()) return
    setSaving(true)
    onSave({ username: username.trim(), password, permissions: perms })
  }

  return (
    <div className="p-4 rounded-xl border border-mamba-gold/30 bg-mamba-gold/5 space-y-4">
      <p className="text-xs font-bold tracking-wider text-mamba-gold uppercase">
        {initial ? 'Editar Usuário' : 'Novo Usuário'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider mb-1">Usuário</label>
          <input value={username} onChange={e => setUsername(e.target.value)}
            disabled={!!initial}
            className="w-full input-mamba rounded-lg px-3 py-2 text-sm disabled:opacity-50" placeholder="username" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider mb-1">
            {initial ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full input-mamba rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider mb-2">Permissões de Acesso</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PERMS.map(p => (
            <PermCheckbox key={p.key} perm={p.key}
              checked={perms.includes(p.key)}
              onChange={() => toggle(p.key)} />
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-mamba-silver hover:bg-mamba-border transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-mamba-gold text-mamba-black hover:bg-yellow-300 transition-colors cursor-pointer disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
const integrations = [
  {
    name: 'Loja Integrada', status: 'configured', icon: '🛒',
    description: 'API de pedidos e catálogo de produtos',
    fields: [
      { label: 'Chave da API',       key: 'LI_CHAVE_API',       value: 'c9b02688ef5097ab6a26',              masked: true },
      { label: 'Chave de Aplicação', key: 'LI_CHAVE_APLICACAO', value: 'df63ca80-5968-4476-9b43-11189846cb9a', masked: true },
    ],
    docsUrl: 'https://developers.lojaintegrada.com.br/',
  },
  {
    name: 'Meta Ads', status: 'configured', icon: '📣',
    description: 'Campanhas, gastos e performance de anúncios',
    fields: [
      { label: 'Account 1 (Mamba 2025)', key: 'META_AD_ACCOUNT_1', value: '1295816082283298', masked: false },
      { label: 'Account 2 (Mamba Army)', key: 'META_AD_ACCOUNT_2', value: '6791359754274084', masked: false },
    ],
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/',
  },
]

export default function ConfiguracoesPage() {
  const [users,      setUsers]      = useState<SafeUser[]>([])
  const [loadingU,   setLoadingU]   = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editUser,   setEditUser]   = useState<SafeUser | null>(null)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [feedback,   setFeedback]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Verifica se é admin pelo cookie
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)mamba_info=([^;]*)/)
      if (match) {
        const info = JSON.parse(decodeURIComponent(match[1]))
        setIsAdmin(info.role === 'admin')
      }
    } catch {}
  }, [])

  const loadUsers = async () => {
    setLoadingU(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) { const d = await res.json(); setUsers(d.users || []) }
    } finally { setLoadingU(false) }
  }

  useEffect(() => { if (isAdmin) loadUsers() }, [isAdmin])

  const notify = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleCreate = async (data: { username: string; password: string; permissions: Permission[] }) => {
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, role: 'user' }),
    })
    if (res.ok) { notify('ok', 'Usuário criado com sucesso'); setShowForm(false); loadUsers() }
    else { const d = await res.json(); notify('err', d.error || 'Erro ao criar usuário') }
  }

  const handleEdit = async (data: { username: string; password: string; permissions: Permission[] }) => {
    if (!editUser) return
    const body: any = { id: editUser.id, permissions: data.permissions }
    if (data.password) body.password = data.password
    const res = await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { notify('ok', 'Usuário atualizado'); setEditUser(null); loadUsers() }
    else { const d = await res.json(); notify('err', d.error || 'Erro ao atualizar') }
  }

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Deletar usuário "${username}"?`)) return
    const res = await fetch('/api/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { notify('ok', 'Usuário removido'); loadUsers() }
    else { notify('err', 'Erro ao remover usuário') }
  }

  return (
    <div className="flex h-screen bg-mamba-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Header title="Configurações" subtitle="Usuários e integrações" />

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 space-y-6 max-w-4xl">

          {/* Feedback toast */}
          {feedback && (
            <div className={cn('p-3 rounded-xl border text-sm font-medium',
              feedback.type === 'ok'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400')}>
              {feedback.msg}
            </div>
          )}

          {/* ── Gerenciamento de Usuários (admin only) ── */}
          {isAdmin && (
            <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-mamba-gold" />
                  <h2 className="text-sm font-black text-mamba-white">Gerenciamento de Usuários</h2>
                </div>
                {!showForm && !editUser && (
                  <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-mamba-gold text-mamba-black hover:bg-yellow-300 transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Novo usuário
                  </button>
                )}
              </div>

              {/* Form criar */}
              {showForm && (
                <div className="mb-4">
                  <UserForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
                </div>
              )}

              {/* Tabela de usuários */}
              {loadingU ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-mamba-gold/30 border-t-mamba-gold rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-mamba-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mamba-border bg-mamba-dark">
                        {['Usuário', 'Papel', 'Permissões', 'Ações'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-bold tracking-wider text-mamba-silver uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <>
                          <tr key={u.id} className="border-b border-mamba-border/60 hover:bg-mamba-dark/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-mamba-gold/20 border border-mamba-gold/30 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-mamba-gold">{u.username.slice(0,2).toUpperCase()}</span>
                                </div>
                                <span className="text-xs font-semibold text-mamba-white">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md',
                                u.role === 'admin' ? 'bg-mamba-gold/10 text-mamba-gold' : 'bg-blue-500/10 text-blue-400')}>
                                {u.role === 'admin' ? 'Admin' : 'Usuário'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {u.role === 'admin'
                                  ? <span className="text-[10px] bg-mamba-gold/10 text-mamba-gold px-2 py-0.5 rounded-md font-bold">Todas</span>
                                  : u.permissions.map(p => (
                                    <span key={p} className="text-[10px] bg-mamba-card text-mamba-silver px-2 py-0.5 rounded-md border border-mamba-border">
                                      {PERMS.find(x => x.key === p)?.label}
                                    </span>
                                  ))
                                }
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {u.role !== 'admin' && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditUser(u); setShowForm(false) }}
                                    className="p-1.5 rounded-md hover:bg-blue-500/10 text-mamba-silver/50 hover:text-blue-400 transition-colors cursor-pointer">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDelete(u.id, u.username)}
                                    className="p-1.5 rounded-md hover:bg-red-500/10 text-mamba-silver/50 hover:text-red-400 transition-colors cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {editUser?.id === u.id && (
                            <tr key={`edit-${u.id}`} className="border-b border-mamba-border/60">
                              <td colSpan={4} className="px-4 py-3">
                                <UserForm initial={editUser} onSave={handleEdit} onCancel={() => setEditUser(null)} />
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[10px] text-mamba-silver/40 mt-3">
                * Usuários criados ficam ativos imediatamente. As alterações são salvas automaticamente.
              </p>
            </div>
          )}

          {/* ── Integrações ── */}
          <div className="rounded-xl border border-mamba-border bg-mamba-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-mamba-gold" />
              <h2 className="text-sm font-black text-mamba-white">Integrações de API</h2>
            </div>
            <p className="text-xs text-mamba-silver/60 mb-5">Credenciais configuradas via variáveis de ambiente na Vercel.</p>

            <div className="space-y-4">
              {integrations.map(integ => (
                <div key={integ.name} className="p-4 rounded-xl bg-mamba-dark border border-mamba-border">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-mamba-card border border-mamba-border flex items-center justify-center text-lg">
                        {integ.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-mamba-white">{integ.name}</h3>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            integ.status === 'configured'
                              ? 'text-green-400 bg-green-400/10 border-green-400/20'
                              : 'text-orange-400 bg-orange-400/10 border-orange-400/20')}>
                            {integ.status === 'configured' ? 'Configurado' : 'Pendente'}
                          </span>
                        </div>
                        <p className="text-xs text-mamba-silver/60 mt-0.5">{integ.description}</p>
                      </div>
                    </div>
                    <a href={integ.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-mamba-silver/50 hover:text-mamba-gold transition-colors cursor-pointer">
                      Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="space-y-2">
                    {integ.fields.map(field => (
                      <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-mamba-black border border-mamba-border/60">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-mamba-silver/60 uppercase tracking-wider mb-0.5">{field.label}</p>
                          <code className="text-xs font-mono text-mamba-silver block truncate">
                            {field.value
                              ? (field.masked ? `${field.value.slice(0,8)}${'•'.repeat(8)}` : field.value)
                              : <span className="text-mamba-silver/30 italic">Não configurado</span>}
                          </code>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {field.value
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            : <AlertCircle className="w-3.5 h-3.5 text-orange-400" />}
                          {field.value && <CopyBtn value={field.value} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
