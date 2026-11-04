// Identidade do portal num lugar só. Enquanto o nome não é escolhido, tudo vem do
// .env com valores provisórios; trocar a marca = mudar estas variáveis (e as cores
// em tailwind.config.ts / render.tsx), sem caçar textos pelo código.

export const BRAND = {
  name:      process.env.PORTAL_BRAND_NAME   || 'Portal DTF',
  tagline:   process.env.PORTAL_TAGLINE      || 'Tutoriais de DTF e estamparia, do arquivo à prensa',
  domain:    process.env.PORTAL_SITE_LABEL   || process.env.DOMAIN || 'portaldtf.com.br',
  instagram: process.env.PORTAL_IG_HANDLE    || 'portaldtf',
  // Página das soluções pagas (encaixe de artes, finalização de arquivos etc.)
  whatsapp:  process.env.PORTAL_WHATSAPP     || '',   // só dígitos com DDI, ex.: 5547999999999
  logoMark:  process.env.PORTAL_LOGO_MARK    || 'DTF',
}

export function whatsappLink(text: string): string | null {
  if (!BRAND.whatsapp) return null
  return `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`
}

export function publicBaseUrl(): string {
  const base = process.env.PORTAL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return base.replace(/\/$/, '')
}
