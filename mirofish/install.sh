#!/usr/bin/env bash
# MiroFish (github.com/666ghj/MiroFish) num VPS, só para testar. Rode DENTRO do VPS, como root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Cleocobra/mamba-dashboard/main/mirofish/install.sh)"
#
# O que faz (pode rodar de novo quando quiser; nada é apagado):
#   1. confere arquitetura, disco e memória (cria swap se o VPS tiver pouca RAM);
#   2. instala o Docker se faltar;
#   3. cria /opt/mirofish com docker-compose.yml e .env (pergunta as chaves aqui no terminal);
#   4. baixa a imagem oficial ghcr.io/666ghj/mirofish e sobe o container;
#   5. espera ficar no ar e mostra como abrir no seu navegador.
#
# Segurança: a porta fica presa em 127.0.0.1 do VPS. Ninguém na internet acessa (e ninguém gasta
# os seus créditos de LLM). Você abre pelo túnel SSH que o script mostra no final.
#
# Variáveis opcionais: DIR (padrão /opt/mirofish), WEB_PORT (porta no VPS, padrão 3000),
#                      IMAGE (padrão ghcr.io/666ghj/mirofish:latest), RECONFIGURAR=1 (refaz o .env)
set -euo pipefail

DIR=${DIR:-/opt/mirofish}
IMAGE=${IMAGE:-ghcr.io/666ghj/mirofish:latest}
NEED_DISK_GB=18      # imagem ~4,8 GB compactada, ~13 GB extraída, mais folga para dados
NEED_MEM_GB=4        # RAM + swap: a simulação do "Twitter" carrega um modelo BERT na memória

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_b=$'\e[1m'; c_0=$'\e[0m'
ok()   { echo "${c_ok}✔${c_0} $*"; }
warn() { echo "${c_warn}!${c_0} $*"; }
die()  { echo "${c_err}✘ $*${c_0}" >&2; exit 1; }
h()    { echo; echo "${c_b}== $* ==${c_0}"; }

[ "$(id -u)" = 0 ] || die "Rode como root (ou: sudo bash -c \"\$(curl -fsSL ...)\")."

# ---------------------------------------------------------------- 1. máquina
h "Conferindo o servidor"
arch=$(uname -m)
[ "$arch" = x86_64 ] || die "Arquitetura $arch: a imagem oficial do MiroFish só existe para x86_64 (amd64)."
ok "arquitetura $arch"

mem_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo)
swap_kb=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
mem_gb=$(( (mem_kb + 524288) / 1048576 ))
ok "memória: ${mem_gb} GB de RAM, $(( (swap_kb + 524288) / 1048576 )) GB de swap"

# disco: mede onde o Docker guarda as imagens (ou a raiz, se o Docker ainda não existe)
docker_root=/var/lib/docker
command -v docker >/dev/null && docker_root=$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
probe=$docker_root; while [ ! -d "$probe" ]; do probe=$(dirname "$probe"); done
free_gb=$(( $(df -Pk "$probe" | awk 'NR==2{print $4}') / 1048576 ))
have_image=0
command -v docker >/dev/null && docker image inspect "$IMAGE" >/dev/null 2>&1 && have_image=1
if [ "$have_image" = 0 ] && [ "$free_gb" -lt "$NEED_DISK_GB" ]; then
  die "Só ${free_gb} GB livres em $probe; a imagem do MiroFish precisa de uns ${NEED_DISK_GB} GB. Libere espaço (ex.: docker system prune -a) e rode de novo."
fi
ok "disco: ${free_gb} GB livres em $probe"

# swap: com pouca RAM o processo morre (OOM) quando a simulação carrega o modelo
total_kb=$(( mem_kb + swap_kb )); need_kb=$(( NEED_MEM_GB * 1048576 ))
if [ "$total_kb" -lt "$need_kb" ]; then
  add_gb=$(( (need_kb - total_kb + 1048575) / 1048576 ))
  if [ -f /swapfile-mirofish ]; then
    warn "já existe /swapfile-mirofish mas RAM+swap ainda está abaixo de ${NEED_MEM_GB} GB; seguindo assim."
  elif [ "$free_gb" -lt $(( NEED_DISK_GB + add_gb )) ] && [ "$have_image" = 0 ]; then
    warn "pouca RAM e pouco disco para criar swap; a simulação pode cair por falta de memória."
  else
    warn "RAM+swap abaixo de ${NEED_MEM_GB} GB: criando ${add_gb} GB de swap em /swapfile-mirofish…"
    if fallocate -l "${add_gb}G" /swapfile-mirofish 2>/dev/null || dd if=/dev/zero of=/swapfile-mirofish bs=1M count=$(( add_gb * 1024 )) status=none; then
      chmod 600 /swapfile-mirofish && mkswap -q /swapfile-mirofish >/dev/null && swapon /swapfile-mirofish \
        && { grep -q '^/swapfile-mirofish ' /etc/fstab || echo '/swapfile-mirofish none swap sw 0 0' >> /etc/fstab; } \
        && ok "swap de ${add_gb} GB ativo" \
        || { warn "não consegui ativar o swap (VPS do tipo OpenVZ/LXC não deixa); seguindo sem."; swapoff /swapfile-mirofish 2>/dev/null || true; rm -f /swapfile-mirofish; }
    else
      warn "não consegui criar o arquivo de swap; seguindo sem."
    fi
  fi
fi

# ---------------------------------------------------------------- 2. docker
h "Docker"
if ! command -v docker >/dev/null; then
  warn "Docker não encontrado; instalando (get.docker.com)…"
  curl -fsSL https://get.docker.com | sh || die "não consegui instalar o Docker."
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker info >/dev/null 2>&1 || die "o Docker está instalado mas não está rodando (tente: systemctl start docker)."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) não disponível. Atualize o Docker (curl -fsSL https://get.docker.com | sh)."
ok "docker $(docker --version | cut -d' ' -f3 | tr -d ,)"

# ---------------------------------------------------------------- 3. arquivos
h "Configuração em $DIR"
mkdir -p "$DIR/uploads"
cd "$DIR"

port_busy() { ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"; }
if [ -f .port ]; then WEB_PORT=${WEB_PORT:-$(cat .port)}; fi
if [ -z "${WEB_PORT:-}" ]; then
  WEB_PORT=3000
  # já rodando de antes? então a porta ocupada é a nossa mesma
  if ! docker ps --format '{{.Names}}' | grep -qx mirofish; then
    while port_busy "$WEB_PORT"; do WEB_PORT=$((WEB_PORT + 1)); done
  fi
fi
echo "$WEB_PORT" > .port

cat > docker-compose.yml <<YML
# Gerado por mirofish/install.sh (mamba-dashboard). Rodar o instalador de novo reescreve este arquivo.
services:
  mirofish:
    image: ${IMAGE}
    container_name: mirofish
    env_file: .env
    environment:
      # o navegador fala só com a porta 3000; o Vite repassa /api para o backend dentro do container
      VITE_API_BASE_URL: "/"
      # as dependências já vêm na imagem; sem isto o "uv run" tenta baixar o hatchling do PyPI a cada start
      UV_NO_SYNC: "1"
      # a imagem publicada liga o modo debug do Flask por padrão (debugger executa código); desliga
      FLASK_DEBUG: "False"
    ports:
      - "127.0.0.1:${WEB_PORT}:3000"
    volumes:
      - ./uploads:/app/backend/uploads
    restart: unless-stopped
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
YML
ok "docker-compose.yml (porta 127.0.0.1:${WEB_PORT} no VPS)"

ask() { # ask VAR "pergunta" "padrão"
  local __v; read -r -p "  $2${3:+ [$3]}: " __v </dev/tty || true; printf -v "$1" '%s' "${__v:-$3}"; }
ask_secret() { # ask_secret VAR "pergunta"
  local __v=""; while [ -z "$__v" ]; do read -r -s -p "  $2 (não aparece ao digitar): " __v </dev/tty || true; echo; done
  printf -v "$1" '%s' "$__v"; }

if [ -f .env ] && [ "${RECONFIGURAR:-0}" != 1 ]; then
  ok ".env já existe (mantido). Para trocar as chaves: RECONFIGURAR=1 antes do comando."
else
  [ -t 0 ] || [ -r /dev/tty ] || die "preciso de um terminal para perguntar as chaves."
  echo
  echo "  O MiroFish precisa de duas chaves:"
  echo "   • um LLM compatível com a API da OpenAI (é ele que gera os agentes e o relatório);"
  echo "   • o Zep Cloud (memória/grafo dos agentes). Crie grátis em https://app.getzep.com → API Keys."
  echo
  echo "  Qual LLM?"
  echo "   1) Alibaba Qwen (o que o projeto recomenda; chave em bailian.console.alibabacloud.com)"
  echo "   2) OpenAI (chave em platform.openai.com)"
  echo "   3) Outro compatível com OpenAI (OpenRouter, DeepSeek, Groq…)"
  ask choice "Escolha" "1"
  case "$choice" in
    2) base="https://api.openai.com/v1"; model="gpt-4o-mini" ;;
    3) base=""; model="" ;;
    *) base="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"; model="qwen-plus" ;;
  esac
  while :; do ask LLM_BASE_URL "URL base do LLM" "$base"; [ -n "$LLM_BASE_URL" ] && break; done
  while :; do ask LLM_MODEL_NAME "Modelo" "$model"; [ -n "$LLM_MODEL_NAME" ] && break; done
  ask_secret LLM_API_KEY "Chave do LLM"
  ask_secret ZEP_API_KEY "Chave do Zep Cloud"
  umask 077
  cat > .env <<ENV
# Chaves do MiroFish. Só root lê este arquivo. Para trocar: RECONFIGURAR=1 e rode o instalador.
LLM_API_KEY=${LLM_API_KEY}
LLM_BASE_URL=${LLM_BASE_URL}
LLM_MODEL_NAME=${LLM_MODEL_NAME}
ZEP_API_KEY=${ZEP_API_KEY}
ENV
  umask 022
  ok ".env criado ($LLM_MODEL_NAME em $LLM_BASE_URL)"
fi

# ---------------------------------------------------------------- 4. subir
h "Baixando a imagem e subindo (a primeira vez demora: são ~4,8 GB)"
docker compose pull
docker compose up -d --remove-orphans
ok "container mirofish iniciado"

# ---------------------------------------------------------------- 5. esperar
h "Esperando ficar no ar"
up_web=0; up_api=0
for _ in $(seq 1 90); do
  state=$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' mirofish 2>/dev/null || echo "false 0")
  if [ "${state%% *}" != true ] || [ "${state##* }" != 0 ]; then
    docker logs --tail 40 mirofish 2>&1
    die "o container caiu (log acima). Chave faltando aparece como 配置错误; rode de novo com RECONFIGURAR=1."
  fi
  curl -fsS -o /dev/null "http://127.0.0.1:${WEB_PORT}/" 2>/dev/null && up_web=1
  # mesma rota que o navegador usa (porta 3000 → proxy do Vite → backend 5001)
  curl -fsS -o /dev/null "http://127.0.0.1:${WEB_PORT}/api/graph/project/list" 2>/dev/null && up_api=1
  [ "$up_web" = 1 ] && [ "$up_api" = 1 ] && break
  sleep 2
done
if [ "$up_web" != 1 ] || [ "$up_api" != 1 ]; then
  docker logs --tail 40 mirofish 2>&1
  die "o MiroFish não respondeu em 3 minutos (log acima). Rode de novo ou veja: docker logs -f mirofish"
fi
ok "interface e backend respondendo"

ip=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
cat <<FIM

${c_b}Pronto.${c_0} O MiroFish está rodando no VPS, visível só para o próprio VPS.

${c_b}Para abrir no seu computador${c_0}, num PowerShell NOVO (não neste ssh), rode e deixe aberto:

    ssh -N -L 3000:127.0.0.1:${WEB_PORT} root@${ip:-IP_DO_VPS}

  (pede a mesma senha do root; a janela fica "parada", é assim mesmo)
  e abra no navegador:  ${c_b}http://localhost:3000${c_0}

Comandos úteis (dentro do VPS):
    docker logs -f mirofish                      # acompanhar o que está acontecendo
    cd $DIR && docker compose restart            # reiniciar
    cd $DIR && docker compose down               # parar (os dados em $DIR/uploads ficam)
    RECONFIGURAR=1 bash -c "\$(curl -fsSL ...)"  # trocar chaves (mesmo comando de instalação)

Dica: cada simulação gasta bastante token. Comece com poucas rodadas (menos de 40).
FIM
