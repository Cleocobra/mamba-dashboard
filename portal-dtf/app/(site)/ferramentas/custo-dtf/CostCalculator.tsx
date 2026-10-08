'use client'

import { useMemo, useState } from 'react'

const brl = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Valores de exemplo (não são recomendação de preço nem de consumo).
const DEFAULTS = {
  larguraCm: 60, rolo: 450, roloM: 100,
  tintaLitro: 220, tintaMlM: 12,
  poKg: 150, poGM: 25,
  outrosM: 1.5, perdaPct: 5, margemPct: 60,
  artW: 10, artH: 10, gapCm: 1,
}
type Field = keyof typeof DEFAULTS

const FIELDS: { group: string; items: { k: Field; label: string; suffix: string; step?: number }[] }[] = [
  { group: 'Filme', items: [
    { k: 'larguraCm', label: 'Largura útil do filme', suffix: 'cm' },
    { k: 'rolo',      label: 'Preço do rolo',         suffix: 'R$', step: 0.01 },
    { k: 'roloM',     label: 'Comprimento do rolo',   suffix: 'm' },
  ]},
  { group: 'Tinta e pó', items: [
    { k: 'tintaLitro', label: 'Preço da tinta (média CMYK + branco)', suffix: 'R$/L', step: 0.01 },
    { k: 'tintaMlM',   label: 'Consumo de tinta por metro',           suffix: 'ml/m', step: 0.1 },
    { k: 'poKg',       label: 'Preço do pó',                          suffix: 'R$/kg', step: 0.01 },
    { k: 'poGM',       label: 'Consumo de pó por metro',              suffix: 'g/m', step: 0.1 },
  ]},
  { group: 'Operação e venda', items: [
    { k: 'outrosM',   label: 'Energia, mão de obra e outros por metro', suffix: 'R$/m', step: 0.01 },
    { k: 'perdaPct',  label: 'Perdas e reimpressões',                   suffix: '%', step: 0.5 },
    { k: 'margemPct', label: 'Margem desejada sobre o custo',           suffix: '%', step: 1 },
  ]},
  { group: 'Estampa (para o preço por peça)', items: [
    { k: 'artW',  label: 'Largura da arte',        suffix: 'cm', step: 0.5 },
    { k: 'artH',  label: 'Altura da arte',         suffix: 'cm', step: 0.5 },
    { k: 'gapCm', label: 'Espaço entre as artes',  suffix: 'cm', step: 0.1 },
  ]},
]

export function CostCalculator() {
  const [v, setV] = useState(DEFAULTS)
  const set = (k: Field, raw: string) => setV(s => ({ ...s, [k]: Math.max(0, Number(raw.replace(',', '.')) || 0) }))

  const r = useMemo(() => {
    const filmeM = v.roloM > 0 ? v.rolo / v.roloM : 0
    const tintaM = (v.tintaMlM / 1000) * v.tintaLitro
    const poM    = (v.poGM / 1000) * v.poKg
    const base   = filmeM + tintaM + poM + v.outrosM
    const custoM = base * (1 + v.perdaPct / 100)
    const precoM = custoM * (1 + v.margemPct / 100)

    // Grade simples: testa a arte em pé e deitada e fica com a que rende mais por metro.
    const perMeter = (w: number, h: number) => {
      if (w <= 0 || h <= 0 || w > v.larguraCm) return 0
      const cols = Math.floor((v.larguraCm + v.gapCm) / (w + v.gapCm))
      const rows = 100 / (h + v.gapCm)
      return cols * rows
    }
    const pecasM = Math.max(perMeter(v.artW, v.artH), perMeter(v.artH, v.artW))
    const aproveitamento = v.larguraCm > 0 ? (pecasM * v.artW * v.artH) / (v.larguraCm * 100) : 0
    return {
      filmeM, tintaM, poM, custoM, precoM, pecasM,
      custoPeca: pecasM > 0 ? custoM / pecasM : 0,
      precoPeca: pecasM > 0 ? precoM / pecasM : 0,
      aproveitamento,
    }
  }, [v])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {FIELDS.map(g => (
          <fieldset key={g.group} className="rounded-2xl border border-white/10 p-5">
            <legend className="px-2 text-xs font-black uppercase tracking-[0.2em] text-ui-accent">{g.group}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.items.map(f => (
                <label key={f.k} className="space-y-1.5 text-sm">
                  <span className="text-slate-300">{f.label}</span>
                  <div className="flex items-center rounded-lg border border-white/15 bg-ui-dark focus-within:border-ui-accent">
                    <input type="number" inputMode="decimal" min={0} step={f.step ?? 1} value={v[f.k]} onChange={e => set(f.k, e.target.value)}
                      className="w-full bg-transparent px-3 py-2 text-ui-white outline-none" />
                    <span className="px-3 text-xs text-slate-500">{f.suffix}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button onClick={() => setV(DEFAULTS)} className="text-xs font-bold text-slate-400 hover:text-ui-accent">Voltar aos valores de exemplo</button>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-ui-accent/30 bg-ui-accent/5 p-5 lg:sticky lg:top-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ui-accent">Resultado</p>
        <Row label="Filme por metro" value={brl(r.filmeM)} />
        <Row label="Tinta por metro" value={brl(r.tintaM)} />
        <Row label="Pó por metro" value={brl(r.poM)} />
        <div className="border-t border-white/10 pt-3" />
        <Row label="Custo por metro (com perdas)" value={brl(r.custoM)} strong />
        <Row label="Preço sugerido por metro" value={brl(r.precoM)} strong accent />
        <div className="border-t border-white/10 pt-3" />
        <Row label={`Estampas ${v.artW}×${v.artH} cm por metro`} value={r.pecasM.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} />
        <Row label="Aproveitamento do filme" value={`${(r.aproveitamento * 100).toFixed(0)}%`} />
        <Row label="Custo por estampa" value={brl(r.custoPeca)} strong />
        <Row label="Preço sugerido por estampa" value={brl(r.precoPeca)} strong accent />
        <p className="pt-2 text-[11px] leading-relaxed text-slate-500">
          O cálculo por estampa usa uma grade simples. Com artes de tamanhos diferentes, um encaixe bem feito no gang sheet
          aumenta o aproveitamento e baixa o custo por peça.
        </p>
      </aside>
    </div>
  )
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`${strong ? 'font-black' : 'font-semibold'} ${accent ? 'text-lg text-ui-accent' : 'text-ui-white'}`}>{value}</span>
    </div>
  )
}
