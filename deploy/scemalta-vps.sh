#!/usr/bin/env bash
# ============================================================================
#  SC em Alta — instalador para o VPS (rode de dentro do clone do mamba-dashboard)
#
#    sudo bash deploy/scemalta-vps.sh
#
#  O que faz, nesta ordem (idempotente: pode rodar quantas vezes quiser):
#    1. atualiza o código (git pull)                       5. certificado HTTPS (Let's Encrypt)
#    2. preenche o .env (pergunta o que faltar)            6. build + restart do container
#    3. confere o DNS do domínio                           7. cron das 6h (gerar) e 8h (publicar)
#    4. instala o server do nginx central                  8. testa o site e imprime o resumo
#
#  Variáveis opcionais: DOMAIN, NGINX_CONTAINER (padrão leadspanel-nginx-1),
#  BRANCH (padrão main), LE_EMAIL (e-mail do Let's Encrypt), SKIP_CERT=1, SKIP_CRON=1
# ============================================================================
set -uo pipefail

DOMAIN=${DOMAIN:-scemalta.com.br}
NGINX_CONTAINER=${NGINX_CONTAINER:-leadspanel-nginx-1}
BRANCH=${BRANCH:-main}
APP_CONTAINER=mamba-dashboard
NET=mamba_proxy
LOG=deploy/scemalta-install.log

c_ok()   { printf "\033[32m✔ %s\033[0m\n" "$*"; }
c_warn() { printf "\033[33m! %s\033[0m\n" "$*"; }
c_err()  { printf "\033[31m✖ %s\033[0m\n" "$*"; }
c_step() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }
die()    { c_err "$*"; exit 1; }

# ── Pré-checagens ───────────────────────────────────────────────────────────
[ -f docker-compose.yml ] && [ -f package.json ] || die "Rode de dentro da pasta do mamba-dashboard (onde está o docker-compose.yml)."
mkdir -p deploy; exec > >(tee -a "$LOG") 2>&1
echo "---- $(date -Is) início ----"
command -v docker >/dev/null || die "docker não encontrado."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) não encontrado."
docker info >/dev/null 2>&1 || die "Sem permissão no docker. Rode com sudo: sudo bash deploy/scemalta-vps.sh"
command -v git >/dev/null || die "git não encontrado."

# ── 1. Código ───────────────────────────────────────────────────────────────
c_step "1/8 Atualizando código (branch $BRANCH)"
git fetch -q origin "$BRANCH" && git checkout -q "$BRANCH" && git pull -q origin "$BRANCH" && c_ok "código em $(git rev-parse --short HEAD)" \
  || c_warn "não consegui atualizar via git; seguindo com o código local."

# ── 2. .env ─────────────────────────────────────────────────────────────────
c_step "2/8 Variáveis de ambiente (.env)"
[ -f .env ] || { cp .env.local.example .env; c_warn ".env criado a partir do .env.local.example — confira LI_* e META_* depois."; }

get_env() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- ; }
set_env() {  # set_env CHAVE VALOR
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf "\n%s=%s\n" "$1" "$2" >> .env; fi
}
ask() {  # ask CHAVE "pergunta" [secret] [default]
  local key=$1 msg=$2 secret=${3:-} def=${4:-} cur val
  cur=$(get_env "$key")
  if [ -n "$cur" ]; then c_ok "$key já definido"; return; fi
  if [ -n "$def" ]; then set_env "$key" "$def"; c_ok "$key = $def"; return; fi
  if [ -n "$secret" ]; then read -r -s -p "$msg: " val; echo; else read -r -p "$msg: " val; fi
  [ -n "$val" ] && set_env "$key" "$val" && c_ok "$key salvo" || c_warn "$key ficou vazio (pode preencher depois no .env)"
}

set_env SCEMALTA_HOST "$DOMAIN"
set_env SCEMALTA_PUBLIC_URL "https://$DOMAIN"
[ -n "$(get_env SCEMALTA_AUTO_PUBLISH)" ] || set_env SCEMALTA_AUTO_PUBLISH true
[ -n "$(get_env CRON_SECRET)" ] || set_env CRON_SECRET "$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -dc a-zA-Z0-9 | head -c 48)"
c_ok "SCEMALTA_HOST, SCEMALTA_PUBLIC_URL, SCEMALTA_AUTO_PUBLISH, CRON_SECRET"
echo "Cole as chaves quando pedido (Enter para pular as opcionais):"
ask ANTHROPIC_API_KEY "Chave da Anthropic (console.anthropic.com → API keys, começa com sk-ant-)" secret
ask BRAVE_API_KEY     "Chave do Brave Search (opcional)" secret
ask IG_USER_ID        "IG_USER_ID (opcional agora; use scripts/scemalta-ig-setup.mjs para descobrir)"
ask IG_ACCESS_TOKEN   "IG_ACCESS_TOKEN (opcional agora)" secret
CRON_SECRET=$(get_env CRON_SECRET)

# ── 3. DNS ──────────────────────────────────────────────────────────────────
c_step "3/8 DNS de $DOMAIN"
MY_IP=$(curl -s --max-time 8 https://api.ipify.org || curl -s --max-time 8 https://ifconfig.me || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}')
DNS_OK=0
echo "IP deste servidor: ${MY_IP:-?}   |   $DOMAIN aponta para: ${DNS_IP:-nada ainda}"
if [ -n "$DNS_IP" ] && [ "$DNS_IP" = "$MY_IP" ]; then DNS_OK=1; c_ok "DNS correto"
else c_warn "DNS ainda não aponta para este servidor. Sigo em frente, mas o certificado HTTPS só sai quando o DNS propagar (rode o script de novo depois)."; fi

# ── 4. nginx ────────────────────────────────────────────────────────────────
c_step "4/8 nginx central ($NGINX_CONTAINER)"
docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER" || die "Container $NGINX_CONTAINER não está rodando. Se o nginx tem outro nome: NGINX_CONTAINER=nome sudo bash deploy/scemalta-vps.sh  (veja: docker ps)"
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
docker network inspect "$NET" -f '{{range .Containers}}{{.Name}} {{end}}' | grep -qw "$NGINX_CONTAINER" || { docker network connect "$NET" "$NGINX_CONTAINER" && c_ok "nginx conectado à rede $NET"; }

mount_of() { docker inspect -f '{{range .Mounts}}{{.Destination}}|{{.Source}}{{"\n"}}{{end}}' "$NGINX_CONTAINER" | awk -F'|' -v d="$1" '$1==d{print $2; exit}'; }
CONFD_HOST=$(mount_of /etc/nginx/conf.d)
LE_HOST=$(mount_of /etc/letsencrypt)
WEBROOT_HOST=$(mount_of /var/www/certbot)
echo "montagens do nginx: conf.d=${CONFD_HOST:-<sem bind>}  letsencrypt=${LE_HOST:-<sem bind>}  webroot=${WEBROOT_HOST:-<sem bind>}"

HAS_CERT=0
docker exec "$NGINX_CONTAINER" test -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null && HAS_CERT=1

write_conf() {  # write_conf https|http
  local tmp; tmp=$(mktemp)
  if [ "$1" = https ]; then
    sed "s/scemalta\.com\.br/$DOMAIN/g" docs/nginx-scemalta.conf > "$tmp"
  else
    cat > "$tmp" <<NGX
# $DOMAIN (HTTP provisório até o certificado sair) → container $APP_CONTAINER
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / {
        proxy_pass         http://$APP_CONTAINER:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGX
  fi
  if [ -n "$CONFD_HOST" ]; then cp "$tmp" "$CONFD_HOST/scemalta.conf"
  else docker cp "$tmp" "$NGINX_CONTAINER:/etc/nginx/conf.d/scemalta.conf"; c_warn "conf.d não é um bind mount: copiei para dentro do container (se o container for recriado, rode o script de novo)."; fi
  rm -f "$tmp"
  docker exec "$NGINX_CONTAINER" mkdir -p /var/www/certbot 2>/dev/null || true
  if docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then docker exec "$NGINX_CONTAINER" nginx -s reload && c_ok "nginx recarregado ($1)"
  else c_err "nginx -t falhou; removendo o arquivo para não derrubar os outros sites"; docker exec "$NGINX_CONTAINER" rm -f /etc/nginx/conf.d/scemalta.conf; [ -n "$CONFD_HOST" ] && rm -f "$CONFD_HOST/scemalta.conf"; docker exec "$NGINX_CONTAINER" nginx -t; return 1; fi
}
if [ "$HAS_CERT" = 1 ]; then write_conf https; else write_conf http; fi

# ── 5. Certificado ──────────────────────────────────────────────────────────
c_step "5/8 Certificado HTTPS"
if [ "$HAS_CERT" = 1 ]; then c_ok "certificado já existe"
elif [ "${SKIP_CERT:-0}" = 1 ]; then c_warn "pulado (SKIP_CERT=1)"
elif [ "$DNS_OK" != 1 ]; then c_warn "pulado: DNS ainda não aponta para cá. Rode o script de novo quando propagar."
else
  LE_EMAIL=${LE_EMAIL:-$(get_env LE_EMAIL)}
  [ -n "$LE_EMAIL" ] || { read -r -p "E-mail para avisos do Let's Encrypt: " LE_EMAIL; set_env LE_EMAIL "$LE_EMAIL"; }
  CERT_OK=0
  if command -v certbot >/dev/null && [ -n "$WEBROOT_HOST" ] && [ -n "$LE_HOST" ]; then
    certbot certonly --webroot -w "$WEBROOT_HOST" -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --config-dir "$LE_HOST" && CERT_OK=1
  else
    # certbot em container, compartilhando os volumes do nginx (webroot + letsencrypt)
    docker run --rm --volumes-from "$NGINX_CONTAINER" certbot/certbot certonly --webroot -w /var/www/certbot \
      -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" && CERT_OK=1
  fi
  if [ "$CERT_OK" = 1 ] && docker exec "$NGINX_CONTAINER" test -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
    HAS_CERT=1; write_conf https && c_ok "HTTPS ativo"
    # renovação automática (uma vez por dia, só renova quando faltar < 30 dias)
    if ! crontab -l 2>/dev/null | grep -q "scemalta-cert"; then
      (crontab -l 2>/dev/null; echo "17 3 * * * docker run --rm --volumes-from $NGINX_CONTAINER certbot/certbot renew -q && docker exec $NGINX_CONTAINER nginx -s reload # scemalta-cert") | crontab -
    fi
  else
    c_warn "não consegui emitir o certificado automaticamente. O site fica em HTTP por enquanto."
    c_warn "Me mande o conteúdo de $LOG que eu ajusto para o seu nginx."
    set_env SCEMALTA_PUBLIC_URL "http://$DOMAIN"
  fi
fi
[ "$HAS_CERT" = 1 ] && set_env SCEMALTA_PUBLIC_URL "https://$DOMAIN"

# ── 6. Build ────────────────────────────────────────────────────────────────
c_step "6/8 Build e restart do container (leva alguns minutos)"
docker compose build web && docker compose up -d web || die "build/up falhou (veja acima)."
for i in $(seq 1 40); do
  docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1 && break; sleep 3
done
docker exec "$APP_CONTAINER" wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1 && c_ok "app respondendo" || c_warn "app ainda não respondeu; veja: docker logs $APP_CONTAINER"

# ── 7. Cron ─────────────────────────────────────────────────────────────────
c_step "7/8 Cron (06:00 gerar, 08:00 publicar, horário de Brasília)"
if [ "${SKIP_CRON:-0}" = 1 ]; then c_warn "pulado (SKIP_CRON=1)"; else
  SCHEME=$([ "$HAS_CERT" = 1 ] && echo https || echo http)
  H6=$(TZ=$(cat /etc/timezone 2>/dev/null || echo UTC) date -d 'TZ="America/Sao_Paulo" 06:00' +%H 2>/dev/null || echo 09)
  H8=$(TZ=$(cat /etc/timezone 2>/dev/null || echo UTC) date -d 'TZ="America/Sao_Paulo" 08:00' +%H 2>/dev/null || echo 11)
  ( crontab -l 2>/dev/null | grep -v "# scemalta-run" | grep -v "# scemalta-publish"
    echo "0 $H6 * * * curl -s -m 600 -X POST -H 'Authorization: Bearer $CRON_SECRET' $SCHEME://$DOMAIN/api/scemalta/run >> /var/log/scemalta.log 2>&1 # scemalta-run"
    echo "0 $H8 * * * curl -s -m 600 -X POST -H 'Authorization: Bearer $CRON_SECRET' $SCHEME://$DOMAIN/api/scemalta/publish >> /var/log/scemalta.log 2>&1 # scemalta-publish"
  ) | crontab - && c_ok "cron instalado (servidor: ${H6}h e ${H8}h; log em /var/log/scemalta.log)"
fi

# ── 8. Teste ────────────────────────────────────────────────────────────────
c_step "8/8 Teste"
BODY=$(curl -s --max-time 20 -H "Host: $DOMAIN" http://127.0.0.1/ || true)
if echo "$BODY" | grep -q "SC em Alta"; then c_ok "site respondendo pelo nginx"; else c_warn "o nginx não devolveu o site (veja o log)."; fi
LOGIN=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Host: $DOMAIN" http://127.0.0.1/login || true)
[ "$LOGIN" = 404 ] && c_ok "/login bloqueado no domínio do site (404)" || c_warn "/login devolveu $LOGIN no domínio do site (esperado 404)"

echo
echo "================================================================"
echo " Site:            $([ "$HAS_CERT" = 1 ] && echo https || echo http)://$DOMAIN"
echo " Painel:          aba 'SC em Alta' no dashboard (permissão 'noticias')"
echo " Gerar agora:     curl -X POST -H 'Authorization: Bearer $CRON_SECRET' $([ "$HAS_CERT" = 1 ] && echo https || echo http)://$DOMAIN/api/scemalta/run"
[ -z "$(get_env ANTHROPIC_API_KEY)" ] && echo " FALTA:           ANTHROPIC_API_KEY no .env (depois: docker compose up -d web)"
[ -z "$(get_env IG_ACCESS_TOKEN)" ]   && echo " Instagram:       node scripts/scemalta-ig-setup.mjs  → preencha IG_* no .env → rode este script de novo"
[ "$DNS_OK" != 1 ] && echo " DNS:             aponte $DOMAIN para $MY_IP e rode este script de novo para o HTTPS"
echo " Log completo:    $LOG"
echo "================================================================"
echo "---- $(date -Is) fim ----"
