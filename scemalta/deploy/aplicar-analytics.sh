#!/usr/bin/env bash
# Aplica o pacote scemalta/contrib/analytics-live (GA4 G-XCHEE64M53) no portal SC em Alta.
# Rode no VPS 177.136.230.12 como root. Idempotente: pode rodar de novo sem duplicar nada.
set -euo pipefail
cd "${1:-/opt/scemalta-src/scemalta}"
[ -f docker-compose.yml ] && [ -f package.json ] || { echo "Nao parece a pasta do scemalta: $(pwd)"; exit 1; }

GA_ID_VALUE=G-XCHEE64M53

echo "==> 1/5  app/(site)/Analytics.tsx"
mkdir -p 'app/(site)'
cat > 'app/(site)/Analytics.tsx' <<'__ANALYTICS_TSX__'
// Medição de audiência do portal. Entra no layout do site (ver APPLY.md).
// Só carrega o que estiver configurado no .env:
//   GTM_ID=GTM-XXXXXXX     Google Tag Manager (o contêiner carrega GA4, pixel etc. do jeito que
//                          for configurado em tagmanager.google.com)
//   GA_ID=G-XXXXXXXXXX     Google Analytics 4 direto, sem GTM (use um ou outro, não os dois)
//   META_PIXEL_ID=123456   Pixel da Meta direto (opcional; se já estiver no GTM, não repita aqui)
// Lido no servidor a cada render, então basta reiniciar o app depois de mudar o .env.

import Script from 'next/script'

export default function Analytics() {
  const gtm   = (process.env.GTM_ID || '').trim()
  const ga    = (process.env.GA_ID || '').trim()
  const pixel = (process.env.META_PIXEL_ID || '').trim()
  if (!gtm && !ga && !pixel) return null
  return (
    <>
      {gtm && (
        <>
          {/* Snippet oficial do GTM: o push de gtm.start/gtm.js é o que dispara os acionadores "Todas as páginas". */}
          <Script id="gtm" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer',${JSON.stringify(gtm)});
          `}</Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtm)}`}
              height="0" width="0" style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(ga)});
          `}</Script>
        </>
      )}
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', ${JSON.stringify(pixel)});
          fbq('track', 'PageView');
        `}</Script>
      )}
    </>
  )
}
__ANALYTICS_TSX__

echo "==> 2/5  <Analytics /> em app/(site)/layout.tsx"
cp -n 'app/(site)/layout.tsx' 'app/(site)/layout.tsx.bak' 2>/dev/null || true
python3 - 'app/(site)/layout.tsx' <<'__PATCH_PY__'
import re, sys, io
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
if 'Analytics' in s:
    print('    (ja aplicado, nada a fazer)'); sys.exit(0)
ims = list(re.finditer(r'(?m)^import .*$', s))
imp = "import Analytics from './Analytics'"
if ims:
    e = ims[-1].end(); s = s[:e] + "\n" + imp + s[e:]
else:
    s = imp + "\n\n" + s
m = re.search(r'<body\b[^>]*>', s) or re.search(r'(?s)return\s*\(\s*<[A-Za-z][^>]*?>', s)
if not m:
    sys.exit('    ERRO: nao achei onde inserir <Analytics />. Edite a mao.')
s = s[:m.end()] + "\n      <Analytics />" + s[m.end():]
io.open(p, 'w', encoding='utf-8').write(s)
print('    inserido')
__PATCH_PY__
grep -n 'Analytics' 'app/(site)/layout.tsx'

echo "==> 3/5  .env"
touch .env
if grep -qE '^[[:space:]]*GTM_ID=[^[:space:]]' .env; then
  echo "    !! GTM_ID ja esta no .env. GA_ID + GTM_ID juntos contam acesso em dobro."
  echo "    !! Comente/remova o GTM_ID e rode de novo. Abortando."
  exit 1
fi
if grep -qE '^[[:space:]]*GA_ID=' .env; then
  sed -i -E "s|^[[:space:]]*GA_ID=.*|GA_ID=${GA_ID_VALUE}|" .env
else
  printf '\n# Google Analytics 4 (SC em Alta)\nGA_ID=%s\n' "$GA_ID_VALUE" >> .env
fi
grep -n '^GA_ID=' .env

echo "==> 4/5  docker compose up -d --build app"
docker compose up -d --build app

echo "==> 5/5  conferindo o site (aguardando ate 90s)"
for i in $(seq 1 18); do
  out=$(curl -s --max-time 10 https://scemalta.com.br/ | grep -o "gtag/js?id=${GA_ID_VALUE}" | head -1 || true)
  if [ -n "$out" ]; then echo "    OK: $out"; exit 0; fi
  sleep 5
done
echo "    AINDA NAO APARECEU. Veja: docker compose logs --tail=50 app"
exit 1
