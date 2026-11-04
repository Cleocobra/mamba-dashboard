import { clsx, type ClassValue } from 'clsx'
import type { Article } from './types'

export function cn(...inputs: ClassValue[]) { return clsx(inputs) }

// "Como prensar DTF em poliamida?" → "como-prensar-dtf-em-poliamida"
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '')
}

export const isValidSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 90

// ~200 palavras por minuto, mínimo 2.
export function readingMinutes(a: Pick<Article, 'introducao' | 'passos' | 'dicas' | 'problemas' | 'faq' | 'conclusao' | 'materiais'>): number {
  const text = [
    a.introducao, a.conclusao, ...a.materiais, ...a.dicas,
    ...a.passos.flatMap(p => [p.titulo, p.texto]),
    ...a.problemas.flatMap(p => [p.problema, p.solucao]),
    ...a.faq.flatMap(f => [f.pergunta, f.resposta]),
  ].join(' ')
  return Math.max(2, Math.round(text.split(/\s+/).filter(Boolean).length / 200))
}

// ISO → "08/10/2026" no fuso de Brasília.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}
