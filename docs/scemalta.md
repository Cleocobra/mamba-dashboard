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

## Colocar no ar (um comando)

Você só precisa de duas coisas fora do servidor: o **DNS** apontando para o VPS e uma
**chave da Anthropic** (console.anthropic.com → API keys). O resto o instalador faz.

```bash
# no VPS, dentro do clone do mamba-dashboard
git pull
sudo bash deploy/scemalta-vps.sh
```

O instalador (`deploy/scemalta-vps.sh`) é idempotente: rode de novo sempre que algo mudar
(DNS propagou, chegou o token do Instagram). Ele:

1. atualiza o código;
2. preenche o `.env` (pergunta a chave da Anthropic; gera o `CRON_SECRET`; Instagram e Brave são opcionais);
3. confere se o DNS já aponta para o servidor;
4. instala o `server` no nginx central (`leadspanel-nginx-1`) e o conecta à rede `mamba_proxy`;
5. emite o certificado Let's Encrypt (quando o DNS estiver certo) e agenda a renovação;
6. faz o build e sobe o container;
7. instala o cron das 6h (gerar) e 8h (publicar) no horário de Brasília;
8. testa o site e imprime o resumo. Tudo fica em `deploy/scemalta-install.log`.

Se o nginx central tiver outro nome: `NGINX_CONTAINER=nome sudo bash deploy/scemalta-vps.sh`.
Se o certificado não sair automaticamente, o site fica em HTTP e o log diz o motivo.

### Instagram em três passos

1. Crie a conta **@scemalta** no Instagram, mude para conta **Profissional** (Business ou Creator)
   e vincule a uma Página do Facebook (pode ser uma Página nova "SC em Alta").
2. Em developers.facebook.com crie um app tipo "Empresa" e, no Explorador da Graph API, gere um
   token com `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
3. Rode o helper, que descobre o `IG_USER_ID` e gera um token de Página **que não expira**:
   ```bash
   node scripts/scemalta-ig-setup.mjs --app-id ID --app-secret SEGREDO --token TOKEN_CURTO
   ```
   Cole as duas linhas no `.env` e rode `sudo bash deploy/scemalta-vps.sh` de novo.

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
