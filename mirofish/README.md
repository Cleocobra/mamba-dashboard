# MiroFish no VPS (para testar)

Instalador de um comando só para o [MiroFish](https://github.com/666ghj/MiroFish), o motor de
previsão por "enxame" de agentes de IA. Ele usa a imagem Docker oficial do projeto, sem
modificações. Esta pasta só tem o instalador e não depende do resto do repositório.

## Antes de começar: duas chaves

| Chave | Para quê | Onde criar |
|---|---|---|
| **LLM** compatível com a API da OpenAI | gera as personas, roda os agentes e escreve o relatório | Qwen (recomendado pelo projeto): bailian.console.alibabacloud.com · OpenAI: platform.openai.com · ou OpenRouter/DeepSeek/etc. |
| **Zep Cloud** | memória e grafo de conhecimento dos agentes | https://app.getzep.com, em API Keys (o plano grátis dá para testar) |

As chaves são digitadas **dentro do VPS**, quando o instalador pedir. Elas ficam só em
`/opt/mirofish/.env`, legível apenas pelo root. Não cole as chaves em chat nem em commit.

## Requisitos do VPS

- Linux **x86_64**. A imagem oficial não tem versão ARM.
- **~18 GB livres** em disco. A imagem tem ~4,8 GB compactada porque traz o PyTorch completo.
- **4 GB de RAM + swap**. A simulação estilo Twitter carrega um modelo BERT na memória. Se o VPS
  tiver menos que isso, o instalador cria um arquivo de swap (`/swapfile-mirofish`). Com 1 GB de
  RAM vai funcionar, mas devagar.

## Instalar

Entre no VPS (`ssh root@IP_DO_VPS`) e rode:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Cleocobra/mamba-dashboard/main/mirofish/install.sh)"
```

O instalador:

1. confere arquitetura, disco e memória, e cria swap se precisar;
2. instala o Docker se faltar;
3. cria `/opt/mirofish` e pergunta qual LLM usar e as duas chaves;
4. baixa a imagem e sobe o container `mirofish`;
5. espera a interface e o backend responderem e mostra o comando para abrir.

Pode rodar de novo quando quiser: as chaves são mantidas e a imagem é atualizada.

## Abrir no navegador

Por segurança, o MiroFish **não fica exposto na internet**: a porta só existe em `127.0.0.1` do
VPS. Sem isso, qualquer pessoa com o IP poderia rodar simulações e gastar os seus créditos de LLM.
Você abre por um túnel SSH. No **seu computador**, num PowerShell novo:

```powershell
ssh -N -L 3000:127.0.0.1:3000 root@IP_DO_VPS
```

Ele pede a senha do root e a janela fica "parada", o que é normal. Deixe essa janela aberta e
acesse **http://localhost:3000**. Para fechar o túnel, use Ctrl+C. O instalador imprime esse
comando já com o IP e a porta certos. Se a 3000 estiver ocupada no VPS, ele usa a 3001, 3002 etc.

## Usar

1. Envie um material-semente (PDF, TXT ou MD: notícia, relatório, capítulo de livro).
2. Descreva em linguagem natural o que quer prever.
3. Acompanhe as etapas: grafo → personas → simulação → relatório.
4. No fim, converse com o ReportAgent ou com qualquer agente simulado.

Cada simulação consome bastante token. Comece com **menos de 40 rodadas**.

## Comandos úteis (dentro do VPS)

```bash
docker logs -f mirofish                       # acompanhar
cd /opt/mirofish && docker compose restart    # reiniciar
cd /opt/mirofish && docker compose down       # parar (os dados em uploads/ ficam)
```

- Para **trocar as chaves ou o modelo**, rode o comando de instalação com `RECONFIGURAR=1` na frente:
  `RECONFIGURAR=1 bash -c "$(curl -fsSL …)"`.
- Para **remover tudo**, rode `cd /opt/mirofish && docker compose down`, depois
  `docker rmi ghcr.io/666ghj/mirofish:latest` e `rm -rf /opt/mirofish`. Para tirar também o swap:
  `swapoff /swapfile-mirofish`, `rm /swapfile-mirofish` e a linha correspondente em `/etc/fstab`.

## Detalhes técnicos

- `docker-compose.yml` gerado: imagem `ghcr.io/666ghj/mirofish:latest`, porta
  `127.0.0.1:3000 → 3000`, volume `./uploads` (projetos, simulações e relatórios).
- O compose define `VITE_API_BASE_URL=/`. Assim o navegador fala só com a porta 3000, e o Vite
  repassa `/api` para o backend (5001) dentro do container. Por isso basta um túnel. Sem essa
  variável, o frontend tentaria `http://localhost:5001` direto do seu navegador.
- A imagem oficial roda o frontend em modo de desenvolvimento (`npm run dev`). Serve para testar,
  mas não é um deploy de produção.
