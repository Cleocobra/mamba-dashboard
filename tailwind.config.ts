import type { Config } from 'tailwindcss'

// Acento white-label resolvido em build-time (mesma lógica de lib/branding.ts —
// duplicado aqui porque o config roda fora do grafo de módulos do app)
const ACCENT     = process.env.NEXT_PUBLIC_ACCENT     || '#FFFF00'
const ACCENT_DIM = process.env.NEXT_PUBLIC_ACCENT_DIM || '#CCCC00'
const ACCENT_RGB = [0, 2, 4]
  .map(i => parseInt(ACCENT.replace('#', '').slice(i, i + 2), 16))
  .join(',')

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mamba: {
          black:   '#0A0A0A',
          dark:    '#111111',
          card:    '#1A1A1A',
          border:  '#2A2A2A',
          gold:    ACCENT,
          'gold-dim': ACCENT_DIM,
          silver:  '#BCBCBC',
          white:   '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient': `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DIM} 100%)`,
        'dark-gradient': 'linear-gradient(180deg, #1A1A1A 0%, #0A0A0A 100%)',
      },
      boxShadow: {
        'gold-glow': `0 0 20px rgba(${ACCENT_RGB},0.15)`,
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-gold': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
