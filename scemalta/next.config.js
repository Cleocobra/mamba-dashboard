/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Esta pasta é um projeto independente dentro do repositório: fixa a raiz do tracing aqui,
  // senão o Next usa a raiz do repo e o standalone sai em .next/standalone/scemalta/.
  outputFileTracingRoot: __dirname,
  // Fontes dos cards são lidas em runtime via fs: precisam ir junto na saída standalone.
  outputFileTracingIncludes: { '/api/**': ['./lib/fonts/**/*'] },
}
module.exports = nextConfig
