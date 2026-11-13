# Pauta manual para o SC em Alta (versão que roda no VPS)

Permite inserir uma matéria escolhida pela equipe de dois jeitos:

1. **Painel** `/admin` → seção "Inserir matéria por link" → cola o link → "Criar post".
2. **WhatsApp**: manda o link da matéria para o número de alertas da Cobra (instância "Cobra Evo"
   da Evolution). Só os números de `APPROVAL_WHATSAPP` são atendidos.

Nos dois casos a matéria vira uma entrada do **plantão de hoje** (igual às que o radar encontra):
lê a página, escreve título e resumo, gera a matéria completa com foto, o áudio e o card, e manda
o pedido de aprovação no WhatsApp com o link `/plantao/DATA/IDX?t=…`. Aprovada, publica no portal
e no Instagram. Nada é publicado sem aprovação.

Feito para o código que está em `/opt/scemalta-src/scemalta` (commit a705c4c, com plantão, reels e
Evolution). Não serve para a versão antiga do GitHub.

## Aplicar (no VPS, dentro de `/opt/scemalta-src/scemalta`)

1. Copie os arquivos desta pasta para os mesmos caminhos:
   - `lib/pauta.ts` (novo)
   - `app/api/pauta/route.ts` (novo)
   - `app/api/inbox/evolution/[[...ev]]/route.ts` (novo; a pasta se chama literalmente `[[...ev]]`)
   - `app/admin/PautaForm.tsx` (novo)
   - `middleware.ts` (substitui o atual; a única mudança é liberar `/api/inbox/*`, que se protege pelo segredo na URL)
2. Em `app/admin/page.tsx`: adicione `import PautaForm from './PautaForm'` no topo e coloque
   `<PautaForm />` logo depois da linha do `sa-schedule` (a que mostra "Publicação agendada para as 8h…").
3. No `.env`, adicione `EVOLUTION_WEBHOOK_SECRET=` com um valor aleatório (`openssl rand -hex 24`).
4. Rebuild do app: `docker compose up -d --build app` (o resto da stack não muda).
5. Teste pelo painel ou por curl:
   ```bash
   curl -u admin:SENHA -X POST -H 'Content-Type: application/json' \
     -d '{"url":"https://g1.globo.com/sc/santa-catarina/..."}' https://scemalta.com.br/api/pauta
   ```
   A resposta traz `aprovar` (link de aprovação) e o card chega no WhatsApp de aprovação.
6. WhatsApp (Evolution Manager em evo.cobrahosting.com.br → instância "Cobra Evo" → Webhook):
   - URL: `https://scemalta.com.br/api/inbox/evolution?k=VALOR_DO_EVOLUTION_WEBHOOK_SECRET`
   - Ativado; eventos: só `MESSAGES_UPSERT`. "Webhook por eventos" pode ficar ligado ou desligado
     (a rota aceita os dois formatos).
   - Teste: do celular que está em `APPROVAL_WHATSAPP`, mande um link para o número de alertas.
7. Commit local: `git add -A && git commit -m "feat: pauta manual (link pelo WhatsApp e painel)"`.

## Observações

- Se a página não tiver foto utilizável, a pauta é recusada com aviso (o card do post exige foto),
  igual ao radar.
- A aprovação expira em `SCEMALTA_RADAR_EXPIRA_H` horas (padrão 4), como no radar.
- Posts manuais contam dentro do dia junto com os do radar, mas não entram no limite
  `SCEMALTA_RADAR_MAX_DIA` (o limite vale só para o que o radar escolhe sozinho).
