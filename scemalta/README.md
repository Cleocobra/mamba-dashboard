# SC em Alta

Todo dia, as 5 notícias que movem Santa Catarina e as oportunidades para quem empreende no
estado, publicadas no site **scemalta.com.br** e no Instagram **@scemalta**. Projeto
independente, pronto para rodar em qualquer VPS (Docker) ou na Vercel.

## Como funciona

```
06:00  agendador → POST /api/run      coleta (RSS + Brave opcional) → Claude edita → rascunho
       painel /admin                  revisar, editar manchete/legenda, aprovar ou rejeitar
08:00  agendador → POST /api/publish  cards JPEG → site → Instagram (carrossel)
```

Sem intervenção, publica às 8h. Rejeitar no painel cancela o dia. Com
`SCEMALTA_AUTO_PUBLISH=false`, só publica o que foi aprovado.

## Estrutura

| Pasta | O que tem |
|---|---|
| `app/(site)` | Site público: home com a edição do dia e histórico, página por data. |
| `app/admin` | Painel (login básico do navegador): gerar, editar, aprovar, rejeitar, publicar, prévia dos cards. |
| `app/api` | `run`, `publish`, `editions`, `editions/[date]`, `img/[date]/[n].jpg` (pública: é a URL que a Meta baixa). |
| `lib/sources.ts` | Coleta: feeds RSS/Atom de veículos catarinenses + Brave News API. Dedup e janela de 36h. |
| `lib/editor.ts` | Claude escolhe as 5 notícias, resume com as próprias palavras, separa oportunidades, escreve legenda. Saída JSON validada; links sempre resolvidos pelo item coletado. |
| `lib/render.tsx` | Cards 1080x1350 (capa, 1 por notícia, oportunidades) via `next/og` → JPEG com sharp. |
| `lib/instagram.ts` | Graph API: containers do carrossel → `media_publish`. |
| `lib/pipeline.ts` | Orquestração, datas em America/Sao_Paulo, autorização. |
| `lib/store.ts` | Redis (edições + imagens com TTL de 90 dias). Sem Redis, memória (só dev). |
| `deploy/` | `install.sh` (um comando), `Caddyfile` (HTTPS automático), `scheduler.sh`, nginx para VPS já ocupado. |
| `scripts/` | `smoke.ts` (parser + cards sem rede), `ig-setup.mjs` (token e id do Instagram). |

## Rodar em um VPS (recomendado)

Qualquer VPS Linux com 1 vCPU / 1 GB serve para começar. Três passos:

1. **DNS**: registro `A` de `scemalta.com.br` e `www` apontando para o IP do VPS.
2. **Chave da Anthropic**: crie em console.anthropic.com → API keys.
3. **No VPS**:
   ```bash
   git clone https://github.com/Cleocobra/mamba-dashboard.git && cd mamba-dashboard/scemalta
   sudo bash deploy/install.sh
   ```
   O instalador instala o Docker se faltar, cria o `.env` (pergunta a chave; gera senha do painel e
   segredo do agendador), sobe app + Redis + agendador + Caddy (HTTPS automático) e imprime o
   resumo com a senha do painel. Pode rodar de novo a qualquer momento.

Se o servidor já tiver nginx/outro proxy nas portas 80/443, o instalador desliga o Caddy e
mostra o modelo `deploy/nginx-vps-existente.conf` para apontar o proxy ao container.

Mudar de servidor no futuro: copie o `.env`, rode o instalador no novo VPS e troque o DNS.
Os dados (edições e cards) ficam no Redis; para levar o histórico, copie o volume `scemalta_redis`.

## Rodar na Vercel (sem servidor)

1. Importe o repositório na Vercel com **Root Directory = `scemalta`**.
2. Crie um Redis no Upstash e defina `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
3. Defina as demais variáveis do `.env.example` (`CRON_SECRET` é obrigatória: a Vercel a envia
   automaticamente nos crons de `vercel.json`, que rodam às 9h e 11h UTC = 6h e 8h em Brasília).
4. Domínio: adicione `scemalta.com.br` no projeto e aponte o `A` para `76.76.21.21`.

## Instagram em três passos

1. Crie a conta **@scemalta**, mude para conta **Profissional** (Business ou Creator) e vincule a
   uma Página do Facebook (pode ser uma Página nova "SC em Alta").
2. Em developers.facebook.com crie um app tipo "Empresa" e, no Explorador da Graph API, gere um
   token com `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
3. Rode o helper, que descobre o `IG_USER_ID` e gera um token de Página **que não expira**:
   ```bash
   npm run ig-setup -- --app-id ID --app-secret SEGREDO --token TOKEN_CURTO
   ```
   Cole as duas linhas no `.env` e `docker compose up -d`.

Limites da API: até 10 imagens por carrossel, legenda até 2.200 caracteres.

## Desenvolvimento local

```bash
npm install
cp .env.example .env            # preencha ADMIN_PASSWORD, CRON_SECRET e ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000 (site) e /admin (painel)
npm run smoke                   # testa o parser RSS e gera os cards em .scemalta-smoke/
```

Sem `REDIS_URL` nem Upstash, o store roda em memória (nada sobrevive ao restart).

## Custos estimados

| Item | Custo |
|---|---|
| VPS 1 vCPU / 1 GB | R$ 25 a 60 por mês |
| Claude Opus 5, 1 edição por dia | US$ 3 a 6 por mês |
| Brave News, 2 buscas por dia | dentro dos US$ 5 grátis mensais |
| Instagram Graph API, Let's Encrypt | grátis |
