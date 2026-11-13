// Medição de audiência do portal. Entra no layout do site (ver APPLY.md).
// Só carrega o que estiver configurado no .env:
//   GA_ID=G-XXXXXXXXXX      Google Analytics 4 (visitantes, páginas, origem, cidades)
//   META_PIXEL_ID=123456    Pixel da Meta (opcional: públicos de leitores para impulsionar depois)
// Lido no servidor a cada render, então basta reiniciar o app depois de mudar o .env.

import Script from 'next/script'

export default function Analytics() {
  const ga    = (process.env.GA_ID || '').trim()
  const pixel = (process.env.META_PIXEL_ID || '').trim()
  if (!ga && !pixel) return null
  return (
    <>
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
