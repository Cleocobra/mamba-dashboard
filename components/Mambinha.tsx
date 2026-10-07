'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { X } from 'lucide-react'
import { formatBRL } from '@/lib/utils'

// ── Mambinha: cobrinha mascote do Fluxo de Caixa ─────────────────────────────
// Reage ao que acontece na página (lançamentos, saldo, salvamento), segue o
// cursor com os olhos, mostra um resumo do período ao ser clicada e fica brava
// se for cutucada 3 vezes. Só aparece para quem a /api/mambinha liberar.

export type EventoMambinha =
  | { tipo: 'entrada' | 'saida'; valor: number; nonce: number }
  | { tipo: 'remocao'; nonce: number }

interface LancamentoResumo {
  tipo: 'entrada' | 'saida'
  valor: number
  categoria: string
}

interface MambinhaProps {
  saldoAtual:   number
  isLoading:    boolean
  isSaving:     boolean
  saveError:    boolean
  evento:       EventoMambinha | null
  periodoLabel: string
  lancamentos:  LancamentoResumo[]   // do período filtrado
}

type Humor =
  | 'tranquila' | 'feliz' | 'careta' | 'anotando' | 'tchau'
  | 'preocupada' | 'pensando' | 'alarmada' | 'dormindo' | 'brava'

const STORAGE_OCULTA = 'mambinha_oculta'
const TEMPO_REACAO   = 2800      // ms que uma reação fica na tela
const TEMPO_SONO     = 60_000    // ms parada até cochilar
const SAIDA_GRANDE   = 500       // R$ a partir do qual a saída dói

function lerOculta(): boolean {
  try { return localStorage.getItem(STORAGE_OCULTA) === '1' } catch { return false }
}
function gravarOculta(v: boolean) {
  try { v ? localStorage.setItem(STORAGE_OCULTA, '1') : localStorage.removeItem(STORAGE_OCULTA) } catch {}
}

export default function Mambinha({
  saldoAtual, isLoading, isSaving, saveError, evento, periodoLabel, lancamentos,
}: MambinhaProps) {
  const [ativo,    setAtivo]    = useState(false)
  const [oculta,   setOculta]   = useState(false)
  const [reacao,   setReacao]   = useState<{ humor: Humor; fala: string } | null>(null)
  const [resumo,   setResumo]   = useState(false)
  const [dormindo, setDormindo] = useState(false)
  const [olhos,    setOlhos]    = useState({ x: 0, y: 0 })

  const cabecaRef   = useRef<SVGGElement>(null)
  const reacaoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sonoTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cutucadas   = useRef<number[]>([])
  const saldoAntes  = useRef<number | null>(null)

  // ── Quem vê a Mambinha (decidido no servidor) ───────────────────────────
  useEffect(() => {
    setOculta(lerOculta())
    fetch('/api/mambinha')
      .then(r => r.json())
      .then(d => setAtivo(!!d.ativo))
      .catch(() => setAtivo(false))
  }, [])

  const reagir = useCallback((humor: Humor, fala: string, tempo = TEMPO_REACAO) => {
    if (reacaoTimer.current) clearTimeout(reacaoTimer.current)
    setReacao({ humor, fala })
    reacaoTimer.current = setTimeout(() => setReacao(null), tempo)
  }, [])

  // ── Cochilo: acorda a cada movimento/tecla ──────────────────────────────
  const acordar = useCallback(() => {
    setDormindo(false)
    if (sonoTimer.current) clearTimeout(sonoTimer.current)
    sonoTimer.current = setTimeout(() => setDormindo(true), TEMPO_SONO)
  }, [])

  // ── Olhos seguem o cursor ───────────────────────────────────────────────
  useEffect(() => {
    if (!ativo || oculta) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      acordar()
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const el = cabecaRef.current
        if (!el) return
        const r  = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const d  = Math.hypot(dx, dy) || 1
        const f  = Math.min(1, d / 120)
        setOlhos({ x: (dx / d) * 2.2 * f, y: (dy / d) * 2.2 * f })
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', acordar)
    acordar()
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', acordar)
      if (frame) cancelAnimationFrame(frame)
      if (sonoTimer.current) clearTimeout(sonoTimer.current)
    }
  }, [ativo, oculta, acordar])

  useEffect(() => () => { if (reacaoTimer.current) clearTimeout(reacaoTimer.current) }, [])

  // ── Lançamentos adicionados/removidos ───────────────────────────────────
  useEffect(() => {
    if (!evento) return
    acordar()
    if (evento.tipo === 'entrada') reagir('feliz', `+${formatBRL(evento.valor)}! Boa! 🎉`)
    else if (evento.tipo === 'saida') {
      if (evento.valor >= SAIDA_GRANDE) reagir('careta', `Ai… −${formatBRL(evento.valor)} 😬`)
      else                              reagir('anotando', `Anotado: −${formatBRL(evento.valor)}`)
    }
    else reagir('tchau', 'Lançamento removido. Tchau! 👋')
  }, [evento, reagir, acordar])

  // ── Saldo cruzou o zero ─────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return
    const antes = saldoAntes.current
    saldoAntes.current = saldoAtual
    if (antes === null) return
    if (antes >= 0 && saldoAtual < 0) reagir('preocupada', 'Opa… o caixa ficou no vermelho 😟', 4000)
    if (antes < 0 && saldoAtual >= 0) reagir('feliz', 'Ufa! Saímos do vermelho! 💛', 4000)
  }, [saldoAtual, isLoading, reagir])

  // ── Erro ao salvar ──────────────────────────────────────────────────────
  useEffect(() => {
    if (saveError) reagir('alarmada', 'Não consegui salvar! Confere a conexão.', 5000)
  }, [saveError, reagir])

  // ── Resumo do período (ao clicar) ───────────────────────────────────────
  const dadosResumo = useMemo(() => {
    let entradas = 0, saidas = 0
    const porCategoria: Record<string, number> = {}
    for (const l of lancamentos) {
      if (l.tipo === 'entrada') entradas += l.valor
      else {
        saidas += l.valor
        porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor
      }
    }
    const maior = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0]
    return { entradas, saidas, maior }
  }, [lancamentos])

  const handleClique = () => {
    acordar()
    const agora = Date.now()
    cutucadas.current = [...cutucadas.current.filter(t => agora - t < 1500), agora]
    if (cutucadas.current.length >= 3) {
      cutucadas.current = []
      setResumo(false)
      reagir('brava', 'Ei! Para de me cutucar! 😤')
      return
    }
    if (reacao?.humor === 'brava') return
    setResumo(r => !r)
  }

  const fechar = () => { gravarOculta(true); setOculta(true); setResumo(false) }
  const reabrir = () => { gravarOculta(false); setOculta(false); reagir('feliz', 'Voltei! 🐍') }

  if (!ativo) return null

  if (oculta) {
    return (
      <button
        onClick={reabrir}
        aria-label="Mostrar a Mambinha"
        title="Mostrar a Mambinha"
        className="fixed bottom-4 right-4 z-30 w-9 h-9 rounded-full bg-mamba-card border border-mamba-border text-lg hover:border-mamba-gold transition-colors cursor-pointer"
      >
        🐍
      </button>
    )
  }

  // Humor de fundo (quando não há reação passageira)
  const humorBase: Humor =
    saveError        ? 'alarmada'   :
    saldoAtual < 0 && !isLoading ? 'preocupada' :
    isSaving         ? 'pensando'   :
    dormindo         ? 'dormindo'   : 'tranquila'
  const humor = reacao?.humor ?? humorBase

  const falaFixa =
    humor === 'dormindo'   ? 'Zzz…' :
    humor === 'pensando'   ? 'Salvando…' :
    null

  return (
    <>
    {/* Espaço no fim da página para a Mambinha não cobrir o último conteúdo */}
    <div aria-hidden className="h-20 md:h-24" />
    <div className="mambinha fixed bottom-3 right-3 md:bottom-5 md:right-5 z-30 flex flex-col items-end select-none" data-humor={humor}>

      {/* Balão: resumo do período */}
      {resumo && !reacao && (
        <div className="mambinha-balao relative mb-2 w-60 rounded-xl border border-mamba-border bg-mamba-dark/95 backdrop-blur p-3 shadow-card text-xs">
          <button onClick={() => setResumo(false)} aria-label="Fechar resumo"
            className="absolute top-2 right-2 text-mamba-silver/60 hover:text-mamba-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="font-bold text-mamba-gold mb-1.5">{periodoLabel}</p>
          {lancamentos.length === 0 ? (
            <p className="text-mamba-silver">Nada lançado nesse período ainda.</p>
          ) : (
            <div className="space-y-1 text-mamba-silver">
              <p>Entrou <span className="font-bold text-green-400 tabular-nums">{formatBRL(dadosResumo.entradas)}</span></p>
              <p>Saiu <span className="font-bold text-red-400 tabular-nums">{formatBRL(dadosResumo.saidas)}</span></p>
              {dadosResumo.maior && (
                <p>Maior gasto: <span className="font-bold text-mamba-white">{dadosResumo.maior[0]}</span>{' '}
                  <span className="tabular-nums">({formatBRL(dadosResumo.maior[1])})</span></p>
              )}
              <p className="pt-1 border-t border-mamba-border/60">
                Saldo atual <span className={`font-black tabular-nums ${saldoAtual >= 0 ? 'text-mamba-gold' : 'text-red-400'}`}>{formatBRL(saldoAtual)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Balão: fala */}
      {(reacao || falaFixa) && (
        <div key={reacao?.fala ?? falaFixa} className="mambinha-balao mb-1 max-w-[15rem] rounded-xl border border-mamba-border bg-mamba-dark/95 px-3 py-2 shadow-card text-xs font-medium text-mamba-white"
          role="status" aria-live="polite">
          {reacao?.fala ?? falaFixa}
        </div>
      )}

      <div className="relative group">
        {/* Fechar */}
        <button onClick={fechar} aria-label="Esconder a Mambinha" title="Esconder a Mambinha"
          className="absolute -top-1 -left-1 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-mamba-card border border-mamba-border text-mamba-silver hover:text-mamba-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer">
          <X className="w-3 h-3" />
        </button>

        <button onClick={handleClique} aria-label="Mambinha — clique para ver o resumo do período"
          className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-mamba-gold rounded-full">
          <Cobra humor={humor} olhos={humor === 'dormindo' ? { x: 0, y: 0 } : olhos} cabecaRef={cabecaRef} />
        </button>
      </div>

      <style>{CSS}</style>
    </div>
    </>
  )
}

// ── Desenho ─────────────────────────────────────────────────────────────────
function Cobra({ humor, olhos, cabecaRef }: {
  humor: Humor
  olhos: { x: number; y: number }
  cabecaRef: React.RefObject<SVGGElement>
}) {
  const fechados = humor === 'dormindo' || humor === 'feliz'
  const boca =
    humor === 'feliz'      ? 'M44 43 Q50 50 56 43' :
    humor === 'careta'     ? 'M44 46 L47 44 L50 46 L53 44 L56 46' :
    humor === 'preocupada' ? 'M45 47 Q50 43 55 47' :
    humor === 'alarmada'   ? null :
    humor === 'brava'      ? 'M45 46 L55 46' :
    humor === 'dormindo'   ? 'M47 45 Q50 46 53 45' :
                             'M45 44 Q50 47 55 44'

  return (
    <svg viewBox="0 0 100 100" className="mambinha-svg w-20 h-20 md:w-24 md:h-24 drop-shadow-[0_4px_12px_rgba(255,255,0,0.15)]" aria-hidden>
      {/* Corpo enrolado */}
      <g className="mambinha-corpo">
        <ellipse cx="50" cy="84" rx="34" ry="11" fill="#CCCC00" />
        <ellipse cx="50" cy="84" rx="34" ry="11" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeDasharray="5 9" />
        <ellipse cx="50" cy="73" rx="26" ry="9" fill="#FFFF00" />
        <ellipse cx="50" cy="73" rx="26" ry="9" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeDasharray="5 9" strokeDashoffset="4" />
        {/* Rabinho */}
        <path className="mambinha-rabo" d="M82 86 Q94 84 92 74" fill="none" stroke="#CCCC00" strokeWidth="5" strokeLinecap="round" />
        {/* Pescoço */}
        <path d="M50 70 Q46 60 50 52" fill="none" stroke="#FFFF00" strokeWidth="14" strokeLinecap="round" />
      </g>

      {/* Cabeça */}
      <g ref={cabecaRef} className="mambinha-cabeca">
        <ellipse cx="50" cy="38" rx="22" ry="17" fill="#FFFF00" />
        <path d="M36 27 Q50 20 64 27" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

        {/* Língua */}
        <path className="mambinha-lingua" d="M50 52 L50 59 M50 59 L47 62 M50 59 L53 62" stroke="#E5484D" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Olhos */}
        {fechados ? (
          <>
            <path d={humor === 'feliz' ? 'M38 37 Q42 33 46 37' : 'M38 37 Q42 39 46 37'} stroke="#0A0A0A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d={humor === 'feliz' ? 'M54 37 Q58 33 62 37' : 'M54 37 Q58 39 62 37'} stroke="#0A0A0A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <g className="mambinha-olhos">
            <circle cx="42" cy="36" r="5.5" fill="#F5F5F5" />
            <circle cx="58" cy="36" r="5.5" fill="#F5F5F5" />
            <circle cx={42 + olhos.x} cy={36 + olhos.y} r={humor === 'alarmada' ? 2 : 3} fill="#0A0A0A" />
            <circle cx={58 + olhos.x} cy={36 + olhos.y} r={humor === 'alarmada' ? 2 : 3} fill="#0A0A0A" />
            {humor === 'brava' && (
              <>
                <path d="M36 29 L47 32" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M64 29 L53 32" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
            {humor === 'preocupada' && (
              <>
                <path d="M37 30 L46 28" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" />
                <path d="M63 30 L54 28" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </g>
        )}

        {/* Bochechas */}
        <circle cx="35" cy="44" r="3" fill="#FF9900" opacity={humor === 'feliz' || humor === 'brava' ? 0.7 : 0.3} />
        <circle cx="65" cy="44" r="3" fill="#FF9900" opacity={humor === 'feliz' || humor === 'brava' ? 0.7 : 0.3} />

        {/* Boca */}
        {boca
          ? <path d={boca} stroke="#0A0A0A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          : <ellipse cx="50" cy="46" rx="3" ry="3.5" fill="#0A0A0A" />}

        {humor === 'dormindo' && <text x="70" y="22" className="mambinha-zzz" fontSize="10" fontWeight="900" fill="#BCBCBC">z</text>}
        {humor === 'pensando' && <text x="70" y="22" fontSize="11" fontWeight="900" fill="#BCBCBC">…</text>}
        {humor === 'alarmada' && <text x="70" y="24" fontSize="14" fontWeight="900" fill="#E5484D">!</text>}
      </g>
    </svg>
  )
}

const CSS = `
.mambinha-svg { overflow: visible; }
.mambinha-cabeca, .mambinha-corpo { transform-box: fill-box; transform-origin: 50% 100%; }
.mambinha-rabo { transform-box: fill-box; transform-origin: 0% 50%; }
.mambinha-lingua { opacity: 0; }

.mambinha[data-humor="tranquila"] .mambinha-cabeca { animation: mb-balanca 4s ease-in-out infinite; }
.mambinha[data-humor="tranquila"] .mambinha-rabo   { animation: mb-rabo 1.6s ease-in-out infinite; }
.mambinha[data-humor="tranquila"] .mambinha-lingua { animation: mb-lingua 5s ease-in-out infinite; }
.mambinha[data-humor="tranquila"] .mambinha-olhos  { animation: mb-pisca 5s infinite; transform-box: fill-box; transform-origin: 50% 50%; }

.mambinha[data-humor="feliz"] .mambinha-svg     { animation: mb-pulo 0.55s ease-out 3; }
.mambinha[data-humor="feliz"] .mambinha-rabo    { animation: mb-rabo 0.35s ease-in-out infinite; }
.mambinha[data-humor="feliz"] .mambinha-lingua  { animation: mb-lingua 0.8s ease-in-out infinite; }

.mambinha[data-humor="careta"] .mambinha-svg    { animation: mb-encolhe 0.6s ease-out forwards; }
.mambinha[data-humor="anotando"] .mambinha-cabeca { animation: mb-aceno 0.5s ease-in-out 2; }
.mambinha[data-humor="tchau"] .mambinha-cabeca  { animation: mb-tchau 0.6s ease-in-out 3; }

.mambinha[data-humor="preocupada"] .mambinha-svg { animation: mb-treme 3s ease-in-out infinite; }
.mambinha[data-humor="alarmada"] .mambinha-svg   { animation: mb-sacode 0.35s ease-in-out 4; }
.mambinha[data-humor="brava"] .mambinha-svg      { animation: mb-sacode 0.25s ease-in-out 5; }

.mambinha[data-humor="pensando"] .mambinha-cabeca { animation: mb-pensa 1s ease-in-out infinite; }

.mambinha[data-humor="dormindo"] .mambinha-cabeca { animation: mb-respira 3.5s ease-in-out infinite; }
.mambinha-zzz { animation: mb-zzz 2.5s ease-in-out infinite; }

.mambinha-balao { animation: mb-balao 0.2s ease-out; transform-origin: 100% 100%; }

@keyframes mb-balanca { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes mb-rabo    { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(14deg); } }
@keyframes mb-lingua  { 0%,88%,100% { opacity: 0; } 90%,96% { opacity: 1; } }
@keyframes mb-pisca   { 0%,94%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
@keyframes mb-pulo    { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-14px); } }
@keyframes mb-encolhe { 0% { transform: scale(1); } 40% { transform: scale(0.85, 0.8); } 100% { transform: scale(0.94); } }
@keyframes mb-aceno   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
@keyframes mb-tchau   { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-10deg); } 75% { transform: rotate(10deg); } }
@keyframes mb-treme   { 0%,100% { transform: translateX(0); } 10%,30% { transform: translateX(-1.5px); } 20%,40% { transform: translateX(1.5px); } 50% { transform: translateX(0); } }
@keyframes mb-sacode  { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px) rotate(-3deg); } 75% { transform: translateX(4px) rotate(3deg); } }
@keyframes mb-pensa   { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
@keyframes mb-respira { 0%,100% { transform: translateY(0) rotate(8deg); } 50% { transform: translateY(2px) rotate(8deg); } }
@keyframes mb-zzz     { 0% { opacity: 0; transform: translate(0,0); } 50% { opacity: 1; } 100% { opacity: 0; transform: translate(6px,-8px); } }
@keyframes mb-balao   { from { opacity: 0; transform: scale(0.9) translateY(4px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .mambinha *, .mambinha { animation: none !important; }
  .mambinha-lingua { opacity: 0; }
}
`
