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

# Caddy (HTTPS automático) só se ninguém estiver usando as portas 80/443.
# Se já existe um nginx em container (ex.: leadspanel-nginx-1), o instalador se encaixa nele.
NGINX_CONTAINER=${NGINX_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -i nginx | head -1)}
if ss -ltn 2>/dev/null | grep -qE ':(80|443) ' && ! docker ps --format '{{.Names}}' | grep -qx scemalta-caddy; then
  set_env COMPOSE_PROFILES ""; MODE=proxy
  if [ -n "$NGINX_CONTAINER" ]; then ok "Portas 80/443 em uso: vou configurar o nginx existente ($NGINX_CONTAINER)"
  else warn "Portas 80/443 em uso e nenhum nginx em container encontrado. Aponte o seu proxy para http://scemalta-app:3000 (modelo em deploy/nginx-vps-existente.conf)."; fi
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

step "4b/6 nginx existente"
HAS_CERT=0
if [ "$MODE" = proxy ] && [ -n "$NGINX_CONTAINER" ]; then
  docker network inspect scemalta -f '{{range .Containers}}{{.Name}} {{end}}' | grep -qw "$NGINX_CONTAINER" \
    || { docker network connect scemalta "$NGINX_CONTAINER" && ok "nginx conectado à rede scemalta"; }
  mount_of() { docker inspect -f '{{range .Mounts}}{{.Destination}}|{{.Source}}{{"\n"}}{{end}}' "$NGINX_CONTAINER" | awk -F'|' -v d="$1" '$1==d{print $2; exit}'; }
  CONFD_HOST=$(mount_of /etc/nginx/conf.d)
  docker exec "$NGINX_CONTAINER" test -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null && HAS_CERT=1
  write_conf() {  # write_conf https|http
    local tmp; tmp=$(mktemp)
    if [ "$1" = https ]; then sed "s/scemalta\.com\.br/$DOMAIN/g" deploy/nginx-vps-existente.conf > "$tmp"
    else cat > "$tmp" <<NGX
# $DOMAIN (HTTP provisório até o certificado sair) → container scemalta-app
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / {
        proxy_pass         http://scemalta-app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }
}
NGX
    fi
    if [ -n "$CONFD_HOST" ]; then cp "$tmp" "$CONFD_HOST/scemalta.conf"
    else docker cp "$tmp" "$NGINX_CONTAINER:/etc/nginx/conf.d/scemalta.conf"; warn "conf.d não é bind mount: copiei para dentro do container (se ele for recriado, rode o script de novo)."; fi
    rm -f "$tmp"; docker exec "$NGINX_CONTAINER" mkdir -p /var/www/certbot 2>/dev/null || true
    if docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then docker exec "$NGINX_CONTAINER" nginx -s reload && ok "nginx recarregado ($1)"
    else err "nginx -t falhou; removendo o arquivo para não derrubar os outros sites"; docker exec "$NGINX_CONTAINER" rm -f /etc/nginx/conf.d/scemalta.conf; [ -n "$CONFD_HOST" ] && rm -f "$CONFD_HOST/scemalta.conf"; docker exec "$NGINX_CONTAINER" nginx -t; return 1; fi
  }
  if [ "$HAS_CERT" = 1 ]; then write_conf https; else write_conf http; fi
  if [ "$HAS_CERT" != 1 ] && [ "$DNS_OK" = 1 ]; then
    LE_EMAIL=$(get_env LE_EMAIL); [ -n "$LE_EMAIL" ] || { read -r -p "E-mail para avisos do Let's Encrypt: " LE_EMAIL; set_env LE_EMAIL "$LE_EMAIL"; }
    docker run --rm --volumes-from "$NGINX_CONTAINER" certbot/certbot certonly --webroot -w /var/www/certbot \
      -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" \
      && docker exec "$NGINX_CONTAINER" test -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && HAS_CERT=1
    if [ "$HAS_CERT" = 1 ]; then
      write_conf https && ok "HTTPS ativo"
      crontab -l 2>/dev/null | grep -q "scemalta-cert" || (crontab -l 2>/dev/null; echo "17 3 * * * docker run --rm --volumes-from $NGINX_CONTAINER certbot/certbot renew -q && docker exec $NGINX_CONTAINER nginx -s reload # scemalta-cert") | crontab -
    else warn "não consegui emitir o certificado; o site fica em HTTP por enquanto. Me mande o $LOG que eu ajusto."; fi
  elif [ "$HAS_CERT" != 1 ]; then warn "certificado fica para quando o DNS apontar para cá (rode o script de novo)."; fi
  [ "$HAS_CERT" = 1 ] && set_env SCEMALTA_PUBLIC_URL "https://$DOMAIN" || set_env SCEMALTA_PUBLIC_URL "http://$DOMAIN"
  docker compose up -d app >/dev/null 2>&1 || true   # relê SCEMALTA_PUBLIC_URL
elif [ "$MODE" = proxy ]; then warn "sem nginx em container: configure o seu proxy com deploy/nginx-vps-existente.conf"
else ok "não se aplica (Caddy ativo)"; fi

step "5/6 Agendador"
docker ps --format '{{.Names}}' | grep -qx scemalta-scheduler && ok "agendador ativo ($(get_env SCEMALTA_RUN_HOUR)h gerar, $(get_env SCEMALTA_PUBLISH_HOUR)h publicar, Brasília)" || warn "container scemalta-scheduler não está rodando"

step "6/6 Resumo"
echo "================================================================"
SCHEME=$([ "$MODE" = edge ] || [ "$HAS_CERT" = 1 ] && echo https || echo http)
echo " Site:      $SCHEME://$DOMAIN   $([ "$DNS_OK" = 1 ] || echo '(depois do DNS propagar)')"
echo " Painel:    $SCHEME://$DOMAIN/admin   usuário: $(get_env ADMIN_USER)   senha: $(get_env ADMIN_PASSWORD)"
echo " Gerar já:  curl -X POST -H 'Authorization: Bearer $(get_env CRON_SECRET)' $SCHEME://$DOMAIN/api/run"
[ -z "$(get_env ANTHROPIC_API_KEY)" ] && echo " FALTA:     ANTHROPIC_API_KEY no .env → depois: docker compose up -d"
[ -z "$(get_env IG_ACCESS_TOKEN)" ]   && echo " Instagram: npm run ig-setup … → IG_* no .env → docker compose up -d"
[ "$MODE" = proxy ] && [ -z "$NGINX_CONTAINER" ] && echo " Proxy:     configure o seu proxy com deploy/nginx-vps-existente.conf"
[ "$DNS_OK" = 1 ] || echo " DNS:       aponte $DOMAIN e www.$DOMAIN para $MY_IP"
echo " Log:       $LOG"
echo "================================================================"
echo "---- $(date -Is) fim ----"
