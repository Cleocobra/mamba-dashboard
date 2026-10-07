import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// ── Mambinha (mascote do Fluxo) — por enquanto só para o Cleo (dono) ───────
// Lista de usuários que veem a Mambinha. Pode ser trocada sem mexer no código
// com a env MAMBINHA_USUARIOS (separados por vírgula). Comparação ignora
// maiúsculas e acentos ("Cléo" = "cleo").
const PADRAO = ['cleo']

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

function usuariosLiberados(): string[] {
  const env = process.env.MAMBINHA_USUARIOS
  const lista = env ? env.split(',') : PADRAO
  return lista.map(normalizar).filter(Boolean)
}

// GET — diz se o usuário logado vê a Mambinha.
// Usa o mamba_token (httpOnly, assinado), não o mamba_info, que o navegador pode editar.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('mamba_token')?.value
  const user  = token ? await verifyToken(token) : null
  const ativo = !!user && usuariosLiberados().includes(normalizar(user.username))
  return NextResponse.json({ ativo }, { headers: { 'Cache-Control': 'no-store' } })
}
