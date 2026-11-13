# Medição de audiência do portal SC em Alta (versão que roda no VPS)

Hoje o site não carrega nenhum script de medição, então não há como saber quantas pessoas
acessaram. Este pacote adiciona o Google Analytics 4 da propriedade SC em Alta
(ID da métrica **G-XCHEE64M53**), ligado por variável do `.env`. Sem a variável, nada é carregado.

## Aplicar (no VPS, dentro de `/opt/scemalta-src/scemalta`)

1. Copie `app/(site)/Analytics.tsx` para o mesmo caminho (a pasta se chama literalmente `(site)`).
2. Em `app/(site)/layout.tsx`: `import Analytics from './Analytics'` e renderize `<Analytics />`
   dentro do `<body>`, logo depois de abri-lo (antes do conteúdo).
3. No `.env`:
   ```
   GA_ID=G-XCHEE64M53
   ```
4. `docker compose up -d --build app`
5. Conferir: `curl -s https://scemalta.com.br/ | grep -o 'gtag/js?id=G-[A-Z0-9]*'` deve mostrar o ID.
   Em analytics.google.com → Relatórios → Tempo real, os acessos aparecem em até 1 minuto.
6. Commit local: `git add -A && git commit -m "feat: Google Analytics 4 no portal"`.

## Tag Manager (opcional, mais tarde)

A conta tem também o contêiner **GTM-P58FMRT3** ("Todas as tags"), que inclui a tag do Google
G-XCHEE64M53. Se um dia quiser gerenciar pixel, eventos ou outras tags por lá sem mexer no site,
troque no `.env`: tire `GA_ID` e ponha `GTM_ID=GTM-P58FMRT3` (um **ou** outro, nunca os dois,
senão cada acesso conta em dobro). O componente carrega o contêiner com o snippet oficial do GTM
(com `gtm.start`/`gtm.js` e `<noscript>`), que vale para esse contêiner e dispara os acionadores
"Todas as páginas". Nesse caso, o GA4 só mede se a tag do Google estiver publicada no contêiner.

`META_PIXEL_ID` carrega o Pixel da Meta direto (opcional; se o pixel já estiver no GTM, não repita).

Opcional: em search.google.com/search-console, adicione a propriedade de domínio
`scemalta.com.br` (TXT no DNS da Cobrahosting). Mostra as buscas do Google que trazem leitores.

## O que dá para medir dos últimos 30 dias (antes do GA4)

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
