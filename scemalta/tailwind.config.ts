import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          black:  '#0B1220',
          dark:   '#0F172A',
          card:   '#111C2E',
          border: '#1E293B',
          accent: '#22C55E',
          'accent-dim': '#16A34A',
          silver: '#94A3B8',
          white:  '#F8FAFC',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
