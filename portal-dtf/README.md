# Portal DTF (nome provisório)

Portal de tutoriais de DTF e estamparia, gerados com IA a partir de uma fila de pautas, revisados no
painel e publicados no site (com SEO) e no Instagram (carrossel). O site também é o funil para as
soluções pagas: encaixe automático de artes (gang sheet) e finalização de arquivos.

É uma cópia adaptada do `scemalta/`: mesma stack (Next.js + Redis + Docker/Caddy ou Vercel), mesmo
instalador de um comando e mesmo modelo de agendador.

## Como funciona

```
fila de pautas  ← você adiciona (com suas notas de produção) ou a IA sugere quando a fila esvazia
06:00  agendador → POST /api/run      próxima pauta → Claude escreve o tutorial → rascunho
       painel /admin                  revisar passos e parâmetros, editar, aprovar ou rejeitar
08:00  agendador → POST /api/publish  cards JPEG → site → Instagram (carrossel)
```

- **A IA não inventa parâmetro técnico.** Temperatura, tempo, pressão e cura vêm da base técnica
  (`lib/knowledge.ts`) ou das notas que você coloca na pauta, sempre como faixa e com a ressalva de
  confirmar na ficha do filme/pó. **Revise a base com os seus testes de produção**: é ela que separa
  o portal de conteúdo genérico.
- Com `PORTAL_AUTO_PUBLISH=false` (padrão do `.env.example`), só vai ao ar o que você aprovar.

## Site público

| Rota | O que é |
|---|---|
| `/` | Home: tutoriais recentes, assuntos, chamada para as soluções |
| `/tutoriais`, `/tutoriais/<slug>` | Lista e página do tutorial com dados estruturados **HowTo + FAQ** (rich results no Google) e imagem de compartilhamento |
| `/categoria/<cat>` | 8 assuntos: fundamentos, arte, equipamentos, insumos, aplicação, problemas, negócio, manutenção |
| `/ferramentas/custo-dtf` | Calculadora de custo por metro e por estampa, com preço sugerido (atrai tráfego recorrente) |
| `/solucoes` | Página de vendas das soluções, com formulário de interessados (+ WhatsApp opcional) |
| `/sitemap.xml`, `/robots.txt` | Gerados automaticamente |

## Estrutura

| Pasta | O que tem |
|---|---|
| `lib/brand.ts` | **Nome, domínio, @ do Instagram, logo e WhatsApp num lugar só** (vindos do `.env`) |
| `lib/knowledge.ts` | Base técnica de DTF que o redator usa (fonte da verdade) |
| `lib/editor.ts` | Claude: escreve o tutorial (JSON validado por schema) e sugere pautas |
| `lib/pipeline.ts` | Fila de pautas, geração, publicação, autorização |
| `lib/render.tsx` | Cards 1080x1350: capa, 1 por passo (até 7), card final |
| `lib/store.ts` | Redis: tutoriais, pautas, interessados, imagens. Sem Redis, memória (só dev) |
| `app/admin` | Painel: Tutoriais, Pautas, Interessados |
| `app/api` | `run`, `publish`, `articles`, `topics`, `leads` (POST público), `img/<slug>/<n>.jpg` (público) |
| `deploy/` | Instalador, Caddy, nginx para VPS já ocupado, agendador |

## Quando escolher o nome

1. Registrar o domínio e criar o @ no Instagram.
2. No `.env`: `DOMAIN`, `PORTAL_PUBLIC_URL`, `PORTAL_BRAND_NAME`, `PORTAL_SITE_LABEL`, `PORTAL_IG_HANDLE`, `PORTAL_LOGO_MARK`.
3. Cores: `tailwind.config.ts` (site e painel) e as constantes no topo de `lib/render.tsx` (cards).
4. Logo em imagem: trocar o selo de texto em `app/(site)/layout.tsx` e `Brand()` em `lib/render.tsx`.

## Rodar em um VPS

O mesmo fluxo do SC em Alta. Dentro do VPS:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Cleocobra/mamba-dashboard/main/portal-dtf/deploy/bootstrap.sh)"
```

Ele baixa o projeto em `/opt/portaldtf-src`, cria o `.env` (pede a chave da Anthropic, gera a senha
do painel e o segredo do agendador) e sobe app, Redis, agendador e Caddy. Se o nginx já ocupa as
portas 80/443 (como no VPS do SC em Alta), ele se encaixa no nginx existente. Os containers e a rede
se chamam `portaldtf-*`, então rodam ao lado do SC em Alta sem conflito.

**Vercel:** Root Directory = `portal-dtf`, Redis no Upstash, `CRON_SECRET` definido (os crons de
`vercel.json` rodam às 6h e 8h de Brasília).

## Primeiros passos depois de subir

1. Painel `/admin` → aba **Pautas** → adicione 10–20 pautas suas, com notas de produção, ou peça à IA.
2. Gere um tutorial, revise os passos com olhar de quem produz, aprove.
3. Instagram: `npm run ig-setup -- --app-id ID --app-secret SEGREDO --token TOKEN_CURTO` (igual ao SC em Alta).
4. Google Search Console: cadastre o domínio e envie `/sitemap.xml`.

## Desenvolvimento local

```bash
npm install
cp .env.example .env            # ADMIN_PASSWORD, CRON_SECRET e ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000 e /admin
npm run smoke                   # testa slug, fila e gera os cards em .portal-smoke/ (sem rede, sem IA)
```

## Custos estimados

| Item | Custo |
|---|---|
| VPS (pode ser o mesmo do SC em Alta) | R$ 0 a 60 por mês |
| Claude Opus 5.5, 1 tutorial por dia + pautas | ≈ US$ 3 a 8 por mês |
| Domínio .com.br | R$ 40 por ano |
| Instagram Graph API, Let's Encrypt | grátis |
