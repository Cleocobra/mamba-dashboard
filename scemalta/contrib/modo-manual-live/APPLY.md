# Modo manual do Instagram para o SC em Alta (versão que roda no VPS)

Com `IG_MODE=manual`, **nada é publicado na API do Instagram**. Tudo o mais continua igual
(edição das 6h, matérias no site, radar/plantão, reels), mas cada post que iria para o Instagram
vira um **pacote no WhatsApp** (números de `APPROVAL_WHATSAPP`, ou `MANUAL_WHATSAPP` se definido):

1. cabeçalho com tipo, título e os links dos cards em alta resolução (e do mp4 do reel);
2. os cards, um por mensagem, na ordem do carrossel (`Card 1/5`, `Card 2/5`…);
3. o reel em vídeo, quando houver;
4. **a legenda sozinha, na última mensagem**, para segurar e "Copiar".

A equipe publica pelo celular. Quando o Instagram voltar a aceitar automação, `IG_MODE=api`
(ou vazio) liga a API de novo, sem mais mudanças.

Feito para o código em `/opt/scemalta-src/scemalta` (commit a705c4c + pauta manual). Não serve
para a versão antiga do GitHub.

## Aplicar (no VPS, dentro de `/opt/scemalta-src/scemalta`)

1. Copie para os mesmos caminhos:
   - `lib/manual.ts` (novo)
   - `app/api/manual/route.ts` (novo)

2. Em `lib/instagram.ts`, importe e ponha o gancho **no início de cada função exportada que chama
   a Graph API** (a que publica imagem/carrossel, normalmente `publishToInstagram(imageUrls, caption)`,
   e a que publica reel, se existir, por ex. `publishReel(videoUrl, caption, coverUrl?)`):

   ```ts
   import { manualMode, enviarPacoteManual } from './manual'

   export async function publishToInstagram(imageUrls: string[], caption: string): Promise<InstagramResult> {
     if (manualMode()) return enviarPacoteManual({ legenda: caption, imagens: imageUrls })
     // ... resto igual
   }

   export async function publishReel(videoUrl: string, caption: string, coverUrl?: string): Promise<InstagramResult> {
     if (manualMode()) return enviarPacoteManual({ tipo: 'Reel', legenda: caption, video: videoUrl, capa: coverUrl })
     // ... resto igual
   }
   ```

   `enviarPacoteManual` devolve `{ mediaId: 'manual:…', permalink: undefined, publishedAt }`, o mesmo
   formato de `InstagramResult`, então o pipeline registra o post normalmente (e não tenta de novo).
   Se a função de reel devolver outro formato, adapte o retorno ali mesmo.

   Ainda em `lib/instagram.ts`, faça `instagramConfigured()` valer no modo manual mesmo sem token:

   ```ts
   export const instagramConfigured = () => manualMode() || cfg() !== null
   ```

   (sem isso, se `IG_USER_ID`/`IG_ACCESS_TOKEN` estiverem vazios o pipeline pula o Instagram e
   nenhum pacote é enviado.)

3. Em `lib/plantao.ts` e `lib/pipeline.ts` **não precisa mexer**: eles chamam as funções acima.
   Só confira com `grep -n "graph.facebook.com\|/media_publish" lib/*.ts` que nenhum outro arquivo
   fala com a Graph API por fora de `lib/instagram.ts`. Se falar, mesmo gancho lá.

4. No `.env`:
   ```
   IG_MODE=manual
   # opcional: para quem mandar os pacotes (padrão: APPROVAL_WHATSAPP)
   # MANUAL_WHATSAPP=5547999999999
   ```
   Pode deixar `IG_USER_ID` e `IG_ACCESS_TOKEN` como estão; no modo manual eles não são usados.

5. Frequência reduzida (enquanto durar o manual). Onde `POST_HOURS`, `RECAP_HOUR` e `RADAR_HOURS`
   são definidos (`docker-compose.yml` do serviço `scheduler` ou `.env`):
   ```
   POST_HOURS=11,16      # 2 posts avulsos por dia (era 10,12,14,16,18)
   RADAR_HOURS=9,13,17   # 3 varreduras do plantão por dia (era de hora em hora)
   ```
   Resumo das 20h: desligar. Veja em `deploy/scheduler.sh` como `RECAP_HOUR` entra no cron; se
   vazio não for tratado, comente a linha do resumo no script em vez de inventar um valor
   (um horário inválido derruba o crontab inteiro). A edição das 6h/8h continua: vira 1 carrossel
   por dia no WhatsApp.

6. Subir:
   ```bash
   docker compose up -d --build app
   docker compose up -d --force-recreate scheduler
   ```

7. Testar (chega um pacote de teste no WhatsApp, sem tocar no Instagram):
   ```bash
   curl -u admin:SENHA https://scemalta.com.br/api/manual     # deve responder {"manual":true,...}
   curl -u admin:SENHA -X POST -H 'Content-Type: application/json' \
     -d '{"tipo":"Teste","legenda":"Legenda de teste do modo manual.\n\n#SantaCatarina","imagens":["https://scemalta.com.br/api/img/DATA/ARQUIVO.jpg"]}' \
     https://scemalta.com.br/api/manual
   ```
   (troque a URL da imagem por um card real; o painel `/admin` mostra os cards do dia.)

8. Commit local: `git add -A && git commit -m "feat: modo manual do Instagram (pacote no WhatsApp)"`.

## Observações

- O pacote é enviado quando o post **seria** publicado: edição de manhã, posts avulsos nas
  `POST_HOURS`, plantão quando aprovado pelo link, reel quando ficar pronto.
- Os cards chegam comprimidos pelo WhatsApp (bom o bastante para o feed). Para subir em alta,
  os links do cabeçalho apontam para os originais em `/api/img/...`, que são públicos.
- O painel e o site vão mostrar o post como "publicado" com id `manual:…`. É esperado.
- Para voltar à API mais tarde: `IG_MODE=api`, `POST_HOURS=12` (1 post/dia), sem reels, e subir
  aos poucos ao longo de semanas. Posts já marcados como `manual:…` não são reenviados.
