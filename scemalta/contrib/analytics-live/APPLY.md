# Medição de audiência do portal SC em Alta (versão que roda no VPS)

Hoje o site não carrega nenhum script de medição, então não há como saber quantas pessoas
acessaram. Este pacote adiciona o Google Tag Manager (contêiner **GTM-P58FMRT3**), ligado por
variável do `.env`. O GA4, o Pixel da Meta e o que mais for preciso ficam configurados dentro do
GTM, sem mexer no site de novo. Sem a variável, nada é carregado.

## Aplicar (no VPS, dentro de `/opt/scemalta-src/scemalta`)

1. Copie `app/(site)/Analytics.tsx` para o mesmo caminho (a pasta se chama literalmente `(site)`).
2. Em `app/(site)/layout.tsx`: `import Analytics from './Analytics'` e renderize `<Analytics />`
   dentro do `<body>`, logo depois de abri-lo (antes do conteúdo).
3. No `.env`:
   ```
   GTM_ID=GTM-P58FMRT3
   ```
   (`GA_ID` e `META_PIXEL_ID` existem para carregar GA4/pixel direto, sem GTM; com o GTM ligado,
   deixe os dois vazios para não medir em dobro.)
4. `docker compose up -d --build app`
5. Conferir: `curl -s https://scemalta.com.br/ | grep -o 'gtm.js?id=GTM-[A-Z0-9]*'` deve mostrar o ID.
6. Commit local: `git add -A && git commit -m "feat: Google Tag Manager no portal"`.

## No Tag Manager (tagmanager.google.com, contêiner GTM-P58FMRT3)

O GTM sozinho não mede nada: ele só carrega as tags que estiverem publicadas no contêiner.
1. Em analytics.google.com, crie (ou localize) a propriedade **SC em Alta** com fluxo Web para
   `https://scemalta.com.br` e copie o ID da métrica (`G-…`).
2. No GTM: Tags → Nova → **Tag do Google** → ID da tag = o `G-…` → acionador **Initialization -
   All Pages** → Salvar.
3. (Opcional) Tags → Nova → **Pixel da Meta** (modelo da galeria) com o ID do pixel →
   acionador All Pages.
4. **Enviar → Publicar** o contêiner. Sem publicar, o site carrega o GTM mas nenhuma tag dispara.
5. Teste com "Visualizar" (Tag Assistant) apontando para https://scemalta.com.br, ou olhe
   "Tempo real" no GA4 um minuto depois.

Opcional: em search.google.com/search-console, adicione a propriedade de domínio
`scemalta.com.br` (TXT no DNS da Cobrahosting). Mostra as buscas do Google que trazem leitores.

## Observação sobre o snippet colado

O trecho recebido (`gtm.js?id=GTM-…` + `gtag('js', new Date())`) carrega o contêiner mas não
faz o push de `gtm.start`/`gtm.js` no dataLayer, que é o que dispara os acionadores "Todas as
páginas". O componente usa o snippet oficial do GTM (com esse push e o `<noscript>`), então as
tags disparam normalmente.

## O que dá para medir dos últimos 30 dias (antes do GTM)

Só o que o nginx central registrou. Para uma estimativa, rode no VPS:
```bash
docker logs leadspanel-nginx-1 --since 720h 2>&1 | grep -F 'scemalta.com.br' \
  | grep -viE 'bot|crawl|spider|facebookexternalhit|whatsapp|preview|curl|python|go-http' \
  | awk '{print substr($4,2,11), $1}' | sort -u | awk '{c[$1]++} END {for (d in c) print d, c[d]}' | sort
```
Isso dá **IPs únicos por dia** (não pessoas: celulares trocam de IP e uma casa compartilha um).
Depende de o log do nginx incluir o host e de o Docker ainda guardar 30 dias de log (por padrão
ele gira os logs e pode ter só alguns dias). Se o `grep` por `scemalta.com.br` não achar nada,
o formato do log não traz o host e a estimativa não é possível; nesse caso, só daqui para frente.
