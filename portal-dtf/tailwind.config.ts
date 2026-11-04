import type { Config } from 'tailwindcss'

// Paleta provisória (CMYK da impressão). Trocar quando a identidade visual for definida,
// junto com as cores de lib/render.tsx (cards do Instagram).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          black:  '#0A0A0F',
          dark:   '#111118',
          card:   '#15151F',
          border: '#27272A',
          accent: '#22D3EE',
          'accent-dim': '#06B6D4',
          pink:   '#F472B6',
          yellow: '#FACC15',
          silver: '#A1A1AA',
          white:  '#F8FAFC',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
