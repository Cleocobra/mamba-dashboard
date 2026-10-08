// Cards do carrossel do Instagram (1080x1350) a partir de um tutorial:
// capa + 1 card por passo (até 7) + card final com chamada para o site.
// JSX → PNG com next/og (satori) → JPEG com sharp (formato exigido pelo Instagram).

import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND } from './brand'
import { CATEGORY_INFO, LEVEL_LABEL, MAX_STEP_CARDS, type Article, type Step } from './types'

export const CARD_W = 1080
export const CARD_H = 1350

// Paleta provisória (CMYK da impressão). Trocar junto com tailwind.config.ts quando a marca sair.
const BG     = '#0A0A0F'
const BG_2   = '#15151F'
const ACCENT = '#22D3EE'   // ciano
const PINK   = '#F472B6'   // magenta
const YELLOW = '#FACC15'   // amarelo
const TEXT   = '#F8FAFC'
const MUTED  = '#A1A1AA'
const LINE   = '#27272A'

let fontCache: { name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[] | null = null
function fonts() {
  if (fontCache) return fontCache
  const dir = path.join(process.cwd(), 'lib', 'fonts')
  fontCache = [
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Regular.ttf')),   weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-ExtraBold.ttf')), weight: 800, style: 'normal' },
  ]
  return fontCache
}

export function cardCountFor(a: Pick<Article, 'passos'>): number {
  return 1 + Math.min(a.passos.length, MAX_STEP_CARDS) + 1
}

// ── Peças visuais ──────────────────────────────────────────────────────────
function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', height: 54, padding: '0 14px', borderRadius: 14, background: ACCENT, alignItems: 'center', justifyContent: 'center', color: BG, fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>{BRAND.logoMark}</div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: TEXT, letterSpacing: -1 }}>{BRAND.name}</div>
    </div>
  )
}

function CmykBar() {
  return (
    <div style={{ display: 'flex', height: 10, width: '100%', marginBottom: 48 }}>
      {[ACCENT, PINK, YELLOW, TEXT].map(c => <div key={c} style={{ display: 'flex', flex: 1, background: c }} />)}
    </div>
  )
}

function Frame({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: CARD_W, height: CARD_H, background: `linear-gradient(160deg, ${BG} 0%, ${BG_2} 100%)`, color: TEXT, fontFamily: 'Inter', padding: 72 }}>
      <CmykBar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${LINE}`, paddingTop: 28, fontSize: 26, color: MUTED }}>
        <div style={{ display: 'flex' }}>{footer ?? BRAND.domain}</div>
        <div style={{ display: 'flex', color: ACCENT, fontWeight: 800 }}>@{BRAND.instagram}</div>
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

function Cover({ a }: { a: Article }) {
  const steps = a.passos.slice(0, MAX_STEP_CARDS)
  return (
    <Frame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <Tag label={CATEGORY_INFO[a.categoria]?.label ?? 'Tutorial'} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 34 }}>
        <div style={{ display: 'flex', fontSize: 30, color: PINK, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>Tutorial · {LEVEL_LABEL[a.nivel]}</div>
        <div style={{ display: 'flex', fontSize: a.titulo.length > 50 ? 72 : 86, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{a.titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, fontSize: 30, color: MUTED, lineHeight: 1.25 }}>
              <div style={{ display: 'flex', color: ACCENT, fontWeight: 800, width: 40 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ display: 'flex', flex: 1 }}>{s.titulo}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: ACCENT, fontWeight: 800 }}>Deslize para o passo a passo →</div>
    </Frame>
  )
}

function StepCard({ s, index, total }: { s: Step; index: number; total: number }) {
  const long = s.texto.length > 260
  return (
    <Frame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <div style={{ display: 'flex', fontSize: 30, color: MUTED, fontWeight: 800 }}>{index}/{total}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 40 }}>
        <div style={{ display: 'flex', fontSize: 150, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{String(index).padStart(2, '0')}</div>
        <div style={{ display: 'flex', fontSize: s.titulo.length <= 40 ? 64 : 54, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>{s.titulo}</div>
        <div style={{ display: 'flex', fontSize: long ? 32 : 37, lineHeight: 1.4, color: '#D4D4D8' }}>{s.texto}</div>
      </div>
    </Frame>
  )
}

function Final({ a }: { a: Article }) {
  return (
    <Frame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <Tag label="Salve este post" color={YELLOW} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 40 }}>
        <div style={{ display: 'flex', fontSize: 70, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>Tutorial completo, com dicas, erros comuns e FAQ</div>
        <div style={{ display: 'flex', fontSize: 38, lineHeight: 1.4, color: '#D4D4D8' }}>{a.resumo}</div>
        <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '22px 34px', borderRadius: 20, background: ACCENT, color: BG, fontSize: 36, fontWeight: 800 }}>Link na bio · {BRAND.domain}</div>
      </div>
    </Frame>
  )
}

// ── Render ────────────────────────────────────────────────────────────────
function elementFor(a: Article, n: number): React.ReactElement {
  const steps = a.passos.slice(0, MAX_STEP_CARDS)
  if (n === 0) return <Cover a={a} />
  if (n >= 1 && n <= steps.length) return <StepCard s={steps[n - 1]} index={n} total={steps.length} />
  if (n === steps.length + 1) return <Final a={a} />
  throw new Error(`Card ${n} não existe neste tutorial.`)
}

export async function renderCard(a: Article, n: number): Promise<Buffer> {
  const res = new ImageResponse(elementFor(a, n), { width: CARD_W, height: CARD_H, fonts: fonts() })
  const png = Buffer.from(await res.arrayBuffer())
  return sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
