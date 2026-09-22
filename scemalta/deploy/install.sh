#!/usr/bin/env bash
# ============================================================================
#  SC em Alta — instalador (VPS novo ou existente). Rode de dentro da pasta scemalta/:
#
#      sudo bash deploy/install.sh
#
#  Faz: instala o Docker se faltar → cria o .env (pergunta só o que falta) →
#  confere o DNS → sobe app + redis + agendador (+ caddy com HTTPS se as portas
#  80/443 estiverem livres) → testa → imprime o resumo. Idempotente.
# ============================================================================
set -uo pipefail
LOG=deploy/install.log
ok()   { printf "\033[32m✔ %s\033[0m\n" "$*"; }
warn() { printf "\033[33m! %s\033[0m\n" "$*"; }
err()  { printf "\033[31m✖ %s\033[0m\n" "$*"; }
step() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }
die()  { err "$*"; exit 1; }

[ -f docker-compose.yml ] && [ -f package.json ] || die "Rode de dentro da pasta scemalta/ (onde está o docker-compose.yml)."
[ "$(id -u)" = 0 ] || die "Rode com sudo: sudo bash deploy/install.sh"
mkdir -p deploy; exec > >(tee -a "$LOG") 2>&1; echo "---- $(date -Is) início ----"

step "1/6 Docker"
if ! command -v docker >/dev/null; then
  warn "Docker não encontrado; instalando (get.docker.com)…"
  curl -fsSL https://get.docker.com | sh || die "não consegui instalar o Docker."
fi
docker compose version >/dev/null 2>&1 || die "docker compose (v2) não disponível."
ok "docker $(docker --version | cut -d' ' -f3 | tr -d ,)"

step "2/6 Configuração (.env)"
[ -f .env ] || cp .env.example .env
get_env() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- ; }
set_env() { if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf "\n%s=%s\n" "$1" "$2" >> .env; fi; }
ask() { local key=$1 msg=$2 secret=${3:-} val; [ -n "$(get_env "$key")" ] && { ok "$key já definido"; return; }
  if [ -n "$secret" ]; then read -r -s -p "$msg: " val; echo; else read -r -p "$msg: " val; fi
  [ -n "$val" ] && set_env "$key" "$val" && ok "$key salvo" || warn "$key vazio (preencha depois no .env)"; }
gen() { openssl rand -hex "$1" 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc a-zA-Z0-9 | head -c "$(( $1 * 2 ))"; }

DOMAIN=$(get_env DOMAIN); [ -n "$DOMAIN" ] || { read -r -p "Domínio do site [scemalta.com.br]: " DOMAIN; DOMAIN=${DOMAIN:-scemalta.com.br}; set_env DOMAIN "$DOMAIN"; }
set_env SCEMALTA_PUBLIC_URL "https://$DOMAIN"
[ -n "$(get_env ADMIN_USER)" ]     || set_env ADMIN_USER admin
[ -n "$(get_env ADMIN_PASSWORD)" ] || set_env ADMIN_PASSWORD "$(gen 12)"
[ -n "$(get_env CRON_SECRET)" ]    || set_env CRON_SECRET "$(gen 24)"
ok "DOMAIN=$DOMAIN, ADMIN_*, CRON_SECRET"
echo "Cole as chaves quando pedido (Enter para pular as opcionais):"
ask ANTHROPIC_API_KEY "Chave da Anthropic (console.anthropic.com → API keys)" secret
ask BRAVE_API_KEY     "Chave do Brave Search (opcional)" secret
ask IG_USER_ID        "IG_USER_ID (opcional; descubra com npm run ig-setup)"
ask IG_ACCESS_TOKEN   "IG_ACCESS_TOKEN (opcional)" secret

# Caddy (HTTPS automático) só se ninguém estiver usando as portas 80/443
if ss -ltn 2>/dev/null | grep -qE ':(80|443) ' && ! docker ps --format '{{.Names}}' | grep -qx scemalta-caddy; then
  set_env COMPOSE_PROFILES ""
  warn "Portas 80/443 já em uso por outro serviço: o Caddy não será ligado."
  warn "Aponte o seu proxy para http://scemalta-app:3000 (modelo em deploy/nginx-vps-existente.conf)."
  MODE=proxy
else
  set_env COMPOSE_PROFILES edge; MODE=edge; ok "Caddy vai cuidar do HTTPS de $DOMAIN e www.$DOMAIN"
fi

step "3/6 DNS de $DOMAIN"
MY_IP=$(curl -s --max-time 8 https://api.ipify.org || curl -s --max-time 8 https://ifconfig.me || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}')
echo "IP deste servidor: ${MY_IP:-?}   |   $DOMAIN aponta para: ${DNS_IP:-nada ainda}"
if [ -n "$DNS_IP" ] && [ "$DNS_IP" = "$MY_IP" ]; then DNS_OK=1; ok "DNS correto"; else DNS_OK=0; warn "DNS ainda não aponta para cá. O site sobe mesmo assim; o HTTPS sai sozinho quando o DNS propagar."; fi

step "4/6 Build e subida dos containers (alguns minutos na primeira vez)"
docker compose up -d --build || die "docker compose falhou (veja acima)."
for i in $(seq 1 40); do docker exec scemalta-app wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 && break; sleep 3; done
docker exec scemalta-app wget -qO- http://127.0.0.1:3000/ 2>/dev/null | grep -q "SC em Alta" && ok "app no ar" || warn "app ainda não respondeu; veja: docker logs scemalta-app"

step "5/6 Agendador"
docker ps --format '{{.Names}}' | grep -qx scemalta-scheduler && ok "agendador ativo ($(get_env SCEMALTA_RUN_HOUR)h gerar, $(get_env SCEMALTA_PUBLISH_HOUR)h publicar, Brasília)" || warn "container scemalta-scheduler não está rodando"

step "6/6 Resumo"
echo "================================================================"
echo " Site:      https://$DOMAIN   $([ "$DNS_OK" = 1 ] || echo '(depois do DNS propagar)')"
echo " Painel:    https://$DOMAIN/admin   usuário: $(get_env ADMIN_USER)   senha: $(get_env ADMIN_PASSWORD)"
echo " Gerar já:  curl -X POST -H 'Authorization: Bearer $(get_env CRON_SECRET)' https://$DOMAIN/api/run"
[ -z "$(get_env ANTHROPIC_API_KEY)" ] && echo " FALTA:     ANTHROPIC_API_KEY no .env → depois: docker compose up -d"
[ -z "$(get_env IG_ACCESS_TOKEN)" ]   && echo " Instagram: npm run ig-setup … → IG_* no .env → docker compose up -d"
[ "$MODE" = proxy ] && echo " Proxy:     configure o nginx com deploy/nginx-vps-existente.conf"
[ "$DNS_OK" = 1 ] || echo " DNS:       aponte $DOMAIN e www.$DOMAIN para $MY_IP"
echo " Log:       $LOG"
echo "================================================================"
echo "---- $(date -Is) fim ----"
