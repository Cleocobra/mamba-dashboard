/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.mamba.army' },
      { protocol: 'https', hostname: 'mamba.army' },
    ],
  },
  // Fontes usadas na renderização dos cards do SC em Alta (lidas em runtime via fs,
  // precisam ir junto na saída standalone).
  outputFileTracingIncludes: {
    '/api/scemalta/**': ['./lib/scemalta/fonts/**/*'],
    '/scemalta/**':     ['./lib/scemalta/fonts/**/*'],
  },
}

module.exports = nextConfig
