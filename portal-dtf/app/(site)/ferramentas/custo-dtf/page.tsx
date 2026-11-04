import type { Metadata } from 'next'
import { CostCalculator } from './CostCalculator'

export const metadata: Metadata = {
  title: 'Calculadora de custo DTF por metro e por estampa',
  description: 'Calcule o custo do DTF por metro (filme, tinta, pó, energia e perdas), quantas estampas cabem no filme e o preço de venda com a sua margem.',
}

export default function CustoDtfPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Calculadora de custo DTF</h1>
        <p className="max-w-2xl text-slate-400">
          Coloque os preços que você paga e o consumo da sua máquina. Os valores que aparecem são só exemplos: o consumo
          real de tinta e pó varia com a cobertura das artes, então meça na sua produção.
        </p>
      </header>
      <CostCalculator />
    </div>
  )
}
