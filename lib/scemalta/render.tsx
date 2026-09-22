// Geração dos cards do carrossel (1080x1350) a partir de uma edição.
// Renderiza JSX → PNG com next/og (satori) e converte para JPEG com sharp,
// que é o formato exigido pela API do Instagram.

import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import type { Edition, NewsItem, Opportunity } from './types'

export const CARD_W = 1080
export const CARD_H = 1350

const BRAND     = 'SC em Alta'
const SITE      = (process.env.SCEMALTA_SITE_LABEL || 'scemalta.com.br')
const BG        = '#0B1220'
const BG_2      = '#111C2E'
const ACCENT    = '#22C55E'
const TEXT      = '#F8FAFC'
const MUTED     = '#94A3B8'

const CAT_LABEL: Record<string, string> = {
  economia: 'Economia', politica: 'Política', cidades: 'Cidades', seguranca: 'Segurança', clima: 'Clima',
  infraestrutura: 'Infraestrutura', educacao: 'Educação', saude: 'Saúde', cultura: 'Cultura', esporte: 'Esporte', outro: 'Destaque',
}
const TIPO_LABEL: Record<string, string> = {
  licitacao: 'Licitação', edital: 'Edital', evento: 'Evento', investimento: 'Investimento', indicador: 'Indicador', outro: 'Oportunidade',
}

let fontCache: { name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[] | null = null
function fonts() {
  if (fontCache) return fontCache
  const dir = path.join(process.cwd(), 'lib', 'scemalta', 'fonts')
  fontCache = [
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Regular.ttf')),   weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-ExtraBold.ttf')), weight: 800, style: 'normal' },
  ]
  return fontCache
}

export function cardCountFor(e: Pick<Edition, 'noticias' | 'oportunidades'>): number {
  return 1 + e.noticias.length + (e.oportunidades.length > 0 ? 1 : 0)
}

function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00-03:00`)
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Peças visuais ──────────────────────────────────────────────────────────
function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', width: 54, height: 54, borderRadius: 14, background: ACCENT, alignItems: 'center', justifyContent: 'center', color: BG, fontSize: 34, fontWeight: 800 }}>↗</div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: TEXT, letterSpacing: -1 }}>{BRAND}</div>
    </div>
  )
}

function Frame({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: CARD_W, height: CARD_H, background: `linear-gradient(160deg, ${BG} 0%, ${BG_2} 100%)`, color: TEXT, fontFamily: 'Inter', padding: 72 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid #1E293B`, paddingTop: 28, fontSize: 26, color: MUTED }}>
        <div style={{ display: 'flex' }}>{footer ?? SITE}</div>
        <div style={{ display: 'flex', color: ACCENT, fontWeight: 800 }}>@scemalta</div>
      </div>
    </div>
  )
}

function Tag({ label, color = ACCENT }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 999, border: `3px solid ${color}`, color, fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

function Cover({ e }: { e: Edition }) {
  return (
    <Frame footer={longDate(e.date)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <Tag label="Edição diária" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 36 }}>
        <div style={{ display: 'flex', fontSize: 30, color: ACCENT, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>O que está em alta em SC hoje</div>
        <div style={{ display: 'flex', fontSize: e.manchete.length > 48 ? 76 : 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{e.manchete}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
          {e.noticias.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, fontSize: 30, color: MUTED, lineHeight: 1.25 }}>
              <div style={{ display: 'flex', color: ACCENT, fontWeight: 800, width: 40 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ display: 'flex', flex: 1 }}>{n.titulo}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: ACCENT, fontWeight: 800 }}>Deslize para ler →</div>
    </Frame>
  )
}

function News({ n, index, total }: { n: NewsItem; index: number; total: number }) {
  const big = n.titulo.length <= 60
  return (
    <Frame footer={`Fonte: ${n.fonte}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <div style={{ display: 'flex', fontSize: 30, color: MUTED, fontWeight: 800 }}>{index}/{total}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 40 }}>
        <Tag label={CAT_LABEL[n.categoria] ?? 'Destaque'} />
        <div style={{ display: 'flex', fontSize: big ? 64 : 54, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>{n.titulo}</div>
        <div style={{ display: 'flex', fontSize: 36, lineHeight: 1.4, color: '#CBD5E1' }}>{n.resumo}</div>
      </div>
    </Frame>
  )
}

function Opportunities({ list }: { list: Opportunity[] }) {
  return (
    <Frame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <Tag label="Oportunidades" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 34 }}>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>Para quem empreende em Santa Catarina</div>
        {list.slice(0, 4).map((o, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 28, borderRadius: 24, background: 'rgba(34,197,94,0.08)', border: '2px solid rgba(34,197,94,0.25)' }}>
            <div style={{ display: 'flex', fontSize: 22, color: ACCENT, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>{TIPO_LABEL[o.tipo] ?? 'Oportunidade'}</div>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>{o.titulo}</div>
            <div style={{ display: 'flex', fontSize: 27, color: '#CBD5E1', lineHeight: 1.35 }}>{o.descricao}</div>
          </div>
        ))}
      </div>
    </Frame>
  )
}

// ── Render ────────────────────────────────────────────────────────────────
function elementFor(e: Edition, n: number): React.ReactElement {
  const total = e.noticias.length
  if (n === 0) return <Cover e={e} />
  if (n >= 1 && n <= total) return <News n={e.noticias[n - 1]} index={n} total={total} />
  if (n === total + 1 && e.oportunidades.length > 0) return <Opportunities list={e.oportunidades} />
  throw new Error(`Card ${n} não existe nesta edição.`)
}

export async function renderCard(e: Edition, n: number): Promise<Buffer> {
  const res = new ImageResponse(elementFor(e, n), { width: CARD_W, height: CARD_H, fonts: fonts() })
  const png = Buffer.from(await res.arrayBuffer())
  return sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}

export async function renderAllCards(e: Edition): Promise<Buffer[]> {
  const out: Buffer[] = []
  for (let n = 0; n < cardCountFor(e); n++) out.push(await renderCard(e, n))
  return out
}
