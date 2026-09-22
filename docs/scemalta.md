# SC em Alta — pipeline diário de notícias + Instagram

Todo dia, o sistema coleta notícias de Santa Catarina, escolhe as 5 mais relevantes,
separa oportunidades para empresários, gera os cards do carrossel e publica no site
(`scemalta.com.br`) e no Instagram (`@scemalta`). Tudo roda dentro do mamba-dashboard.

## Fluxo

```
06:00  POST /api/scemalta/run      → coleta (RSS + Brave) → Claude edita → rascunho no Redis
       painel /noticias            → revisar, editar manchete/legenda, aprovar ou rejeitar
08:00  POST /api/scemalta/publish  → renderiza cards (JPEG) → site → Instagram (carrossel)
```

- Sem ninguém mexer, a edição é publicada às 8h. Rejeitar no painel cancela a publicação do dia.
- Com `SCEMALTA_AUTO_PUBLISH=false`, o cron só publica edições aprovadas.
- "Publicar agora" no painel publica na hora, independente do cron.

## Arquivos

| Caminho | O que faz |
|---|---|
| `lib/scemalta/sources.ts` | Coleta: feeds RSS/Atom + Brave News API. Dedup e janela de 36h. |
| `lib/scemalta/editor.ts` | Claude escolhe as 5 notícias, resume, separa oportunidades, escreve legenda. Saída JSON validada. |
| `lib/scemalta/render.tsx` | Cards 1080x1350 (capa + 1 por notícia + oportunidades) via `next/og` → JPEG com sharp. |
| `lib/scemalta/instagram.ts` | Graph API: containers do carrossel → `media_publish`. |
| `lib/scemalta/pipeline.ts` | Orquestra gerar/publicar, datas em America/Sao_Paulo, autorização das rotas. |
| `lib/scemalta/store.ts` | Persistência no Redis (edições + imagens, 90 dias). |
| `app/api/scemalta/*` | `run`, `publish`, `editions`, `editions/[date]`, `img/[date]/[n].jpg` (pública). |
| `app/scemalta/*` | Site público. |
| `app/noticias/page.tsx` | Painel de revisão no dashboard (permissão `noticias`). |

## Variáveis de ambiente

Veja `.env.local.example`, seção "SC em Alta". Obrigatórias para rodar de ponta a ponta:
`ANTHROPIC_API_KEY`, `CRON_SECRET`, `SCEMALTA_PUBLIC_URL`, `IG_USER_ID`, `IG_ACCESS_TOKEN`.

## Colocar no ar (ordem)

1. **DNS** (painel da Cobrahosting, zona `scemalta.com.br`): registro `A` para `@` e para `www`
   apontando para o IP do VPS onde roda o docker do dashboard. Confira com `dig +short scemalta.com.br`.
2. **nginx**: adicione `docs/nginx-scemalta.conf` no nginx central, gere o certificado
   (`certbot certonly --webroot -w /var/www/certbot -d scemalta.com.br -d www.scemalta.com.br`)
   e recarregue (`nginx -s reload`).
3. **.env** do container: variáveis da seção "SC em Alta" de `.env.local.example`
   (`SCEMALTA_HOST=scemalta.com.br`, `SCEMALTA_PUBLIC_URL=https://scemalta.com.br`, `CRON_SECRET`, `ANTHROPIC_API_KEY`).
4. **Deploy**: merge deste PR, depois no VPS `git pull && docker compose build web && docker compose up -d web`.
   Teste: `https://scemalta.com.br` deve mostrar "Em breve" e `/login` deve dar 404 nesse host.
5. **Primeira edição** pelo painel `/noticias` do dashboard ("Gerar edição de hoje"), sem Instagram ainda.
6. **Instagram**: seção abaixo. Só depois preencha `IG_USER_ID` / `IG_ACCESS_TOKEN` e reinicie o container.
7. **Cron**: seção "Cron no VPS".

## Instagram: o que precisa existir

1. Conta do Instagram **Business** ou **Creator**, vinculada a uma Página do Facebook.
2. App no [Meta for Developers](https://developers.facebook.com) com o produto *Instagram Graph API*
   e as permissões `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
   Enquanto quem publica for admin/tester do app, não precisa de App Review.
3. Token de usuário **de longa duração** (60 dias) gerado no Graph API Explorer com essas permissões.
   `IG_USER_ID` é o id da conta do Instagram (campo `instagram_business_account` da Página).
4. Renovar o token antes de expirar (troca via `oauth/access_token?grant_type=fb_exchange_token`).
   Se preferir tokens que não expiram, use um *System User* no Business Manager.
5. As imagens são baixadas pela Meta a partir de `SCEMALTA_PUBLIC_URL/api/scemalta/img/...`.
   Essa rota é pública por design (sem login) e serve JPEG, o formato exigido.

Limites: até 10 imagens por carrossel, legenda até 2.200 caracteres, dezenas de posts por dia via API.

## Cron no VPS

```cron
# SC em Alta — gerar rascunho às 6h e publicar às 8h (horário do servidor em America/Sao_Paulo)
0 6 * * * curl -s -X POST -H "Authorization: Bearer SEU_CRON_SECRET" https://scemalta.com.br/api/scemalta/run
0 8 * * * curl -s -X POST -H "Authorization: Bearer SEU_CRON_SECRET" https://scemalta.com.br/api/scemalta/publish
```

Se o servidor estiver em UTC, use `0 9` e `0 11`.

## nginx: domínio do site

Exemplo pronto em `docs/nginx-scemalta.conf`: um `server` para `scemalta.com.br` com
`proxy_pass http://mamba-dashboard:3000` e `proxy_set_header Host $host`. Com
`SCEMALTA_HOST=scemalta.com.br`, o middleware serve o site público na raiz desse host e
bloqueia o resto do dashboard nele. As rotas `/api/scemalta/*` continuam acessíveis
(o cron pode chamar pelo domínio do site).

## Testar sem cron

```bash
# gerar a edição de hoje (precisa de ANTHROPIC_API_KEY)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scemalta/run
# ver os cards
open http://localhost:3000/api/scemalta/img/$(date +%F)/0.jpg
# publicar só no site (sem Instagram)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/scemalta/publish?instagram=0"
```

Para semear uma edição de teste sem chamar o Claude, faça `PUT /api/scemalta/editions/YYYY-MM-DD`
com `{ manchete, noticias[], oportunidades[], legenda, hashtags[] }`.

## Custos estimados

| Item | Custo |
|---|---|
| Claude Opus 5, 1 edição/dia | ~US$ 0,10 a 0,20 por dia |
| Brave News, 2 buscas/dia | dentro dos US$ 5 grátis mensais |
| Instagram Graph API | grátis |
| Redis | ~1 MB por edição (imagens), expira em 90 dias |
