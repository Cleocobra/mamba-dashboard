# Medição de audiência do portal SC em Alta (versão que roda no VPS)

Hoje o site não carrega nenhum script de medição, então não há como saber quantas pessoas
acessaram. Este pacote adiciona Google Analytics 4 (e, opcionalmente, o Pixel da Meta),
ligados por variáveis do `.env`. Sem as variáveis, nada é carregado.

## Antes (no Google)

1. Em analytics.google.com, crie a propriedade **SC em Alta** (fuso America/Sao_Paulo, moeda BRL)
   com um fluxo de dados **Web** para `https://scemalta.com.br`. Copie o **ID da métrica** (`G-…`).
2. Opcional: em search.google.com/search-console, adicione a propriedade de domínio
   `scemalta.com.br` (verificação por TXT no DNS da Cobrahosting). Dá as buscas do Google que
   trazem gente ao portal, sem script nenhum.

## Aplicar (no VPS, dentro de `/opt/scemalta-src/scemalta`)

1. Copie `app/(site)/Analytics.tsx` para o mesmo caminho (a pasta se chama literalmente `(site)`).
2. Em `app/(site)/layout.tsx`: `import Analytics from './Analytics'` e renderize `<Analytics />`
   dentro do `<body>`, logo antes de fechar a tag (fora de qualquer `<main>`).
3. No `.env`:
   ```
   GA_ID=G-XXXXXXXXXX
   # META_PIXEL_ID=   (opcional)
   ```
4. `docker compose up -d --build app`
5. Conferir: `curl -s https://scemalta.com.br/ | grep -o 'gtag/js?id=G-[A-Z0-9]*'` deve mostrar o ID.
   No GA4, "Tempo real" passa a mostrar os acessos em até 1 minuto.
6. Commit local: `git add -A && git commit -m "feat: analytics (GA4 e pixel) no portal"`.

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
