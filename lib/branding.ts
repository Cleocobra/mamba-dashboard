// Identidade da instância (white-label). NEXT_PUBLIC_* é inlined no build do
// Next — cada loja builda sua própria imagem passando build args no compose.
// Sem as vars, mantém a marca Mamba Army (comportamento original).
export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Mamba Army'
export const STORE_LOGO = process.env.NEXT_PUBLIC_STORE_LOGO || '/logo-mamba.png'

// Cor de destaque (substitui o dourado em UI, gráficos e CSS vars)
export const ACCENT     = process.env.NEXT_PUBLIC_ACCENT     || '#FFFF00'
export const ACCENT_DIM = process.env.NEXT_PUBLIC_ACCENT_DIM || '#CCCC00'

// '#RRGGBB' → 'r,g,b' (para rgba() no CSS)
export const ACCENT_RGB = [0, 2, 4]
  .map(i => parseInt(ACCENT.replace('#', '').slice(i, i + 2), 16))
  .join(',')
