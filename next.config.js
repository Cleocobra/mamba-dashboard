/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.mamba.army' },
      { protocol: 'https', hostname: 'mamba.army' },
    ],
  },
}

module.exports = nextConfig
