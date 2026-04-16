'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Crosshair, Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || 'Erro ao entrar')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mamba-black flex items-center justify-center p-4">
      {/* Background grid subtle */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,0,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-mamba-dark border border-mamba-border rounded-2xl p-8 shadow-card">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-mamba-gold rounded-xl flex items-center justify-center mb-4 shadow-gold-glow">
              <Crosshair className="w-7 h-7 text-mamba-black" strokeWidth={2.5} />
            </div>
            <p className="text-xl font-black tracking-[0.3em] text-mamba-gold uppercase leading-none">MAMBA</p>
            <p className="text-xs tracking-[0.5em] text-mamba-silver/60 uppercase mt-1">ARMY</p>
            <p className="text-xs text-mamba-silver/40 mt-3">Painel Operacional</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-mamba-silver/60 uppercase mb-2">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mamba-silver/40" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full input-mamba rounded-lg pl-10 pr-4 py-3 text-sm"
                  placeholder="seu usuário"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-mamba-silver/60 uppercase mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mamba-silver/40" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full input-mamba rounded-lg pl-10 pr-10 py-3 text-sm"
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mamba-silver/40 hover:text-mamba-silver transition-colors cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-mamba-gold text-mamba-black font-black py-3 rounded-lg text-sm tracking-widest uppercase hover:bg-yellow-300 transition-colors disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-mamba-black/30 border-t-mamba-black rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-mamba-silver/20 mt-6 tracking-wider">
          MAMBA ARMY © {new Date().getFullYear()} — USO INTERNO
        </p>
      </div>
    </div>
  )
}
