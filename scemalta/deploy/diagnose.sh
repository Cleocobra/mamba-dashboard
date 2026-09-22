#!/usr/bin/env bash
# Diagnóstico do SC em Alta no VPS. Só lê, não muda nada. Rode na pasta scemalta/ e cole a saída no chat:
#   sudo bash deploy/diagnose.sh
DOMAIN=${DOMAIN:-$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2)}; DOMAIN=${DOMAIN:-scemalta.com.br}
h() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }

h "containers"; docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>&1
h "portas 80/443 no host"; (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443) ' || echo "(nada escutando ou ss/netstat ausente)"
h ".env (sem segredos)"
grep -E '^(DOMAIN|SCEMALTA_PUBLIC_URL|COMPOSE_PROFILES|ADMIN_USER|SCEMALTA_AUTO_PUBLISH|LE_EMAIL)=' .env 2>/dev/null
for k in ANTHROPIC_API_KEY ADMIN_PASSWORD CRON_SECRET IG_USER_ID IG_ACCESS_TOKEN; do printf "%s=%s\n" "$k" "$(grep -qE "^$k=.+" .env 2>/dev/null && echo '(definido)' || echo '(vazio)')"; done
h "app (dentro do container)"
docker exec scemalta-app wget -qO- http://127.0.0.1:3000/ 2>/dev/null | grep -o "SC em Alta\|Em breve" | sort -u || echo "app não respondeu"
docker logs --tail 15 scemalta-app 2>&1 | tail -15
h "scheduler"; docker logs --tail 5 scemalta-scheduler 2>&1
h "caddy"; docker logs --tail 15 scemalta-caddy 2>&1 | tail -15
NG=$(docker ps --format '{{.Names}}' | grep -i nginx | head -1)
h "nginx: ${NG:-nenhum container com 'nginx' no nome}"
if [ -n "$NG" ]; then
  docker inspect -f 'imagem={{.Config.Image}}' "$NG"
  echo "montagens:"; docker inspect -f '{{range .Mounts}}  {{.Destination}} <- {{.Source}}{{"\n"}}{{end}}' "$NG"
  echo "na rede scemalta: $(docker network inspect scemalta -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null)"
  echo "nginx -t:"; docker exec "$NG" nginx -t 2>&1 | tail -2
  echo "conf.d:"; docker exec "$NG" sh -c 'ls -la /etc/nginx/conf.d/ 2>/dev/null'
  echo "includes:"; docker exec "$NG" sh -c 'grep -n "include" /etc/nginx/nginx.conf'
  echo "bloco do domínio:"; docker exec "$NG" sh -c "nginx -T 2>/dev/null | grep -n -B3 -A22 'server_name .*$DOMAIN'" | head -90
  echo "servers 443 / default / 444:"; docker exec "$NG" sh -c "nginx -T 2>/dev/null | grep -n -E 'listen .*443|return 444|default_server|ssl_reject_handshake|ssl_certificate '" | head -30
  echo "certificado:"; docker exec "$NG" ls -la "/etc/letsencrypt/live/$DOMAIN/" 2>&1 | head -6
fi
h "testes de dentro do VPS"
curl -s -o /dev/null -m 10 -w "http  Host=$DOMAIN            -> %{http_code} %{redirect_url}\n" -H "Host: $DOMAIN" http://127.0.0.1/
curl -sk -o /dev/null -m 10 -w "https (h2)                    -> %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || echo "https (h2)                    -> falhou (conexão derrubada)"
curl -sk --http1.1 -o /dev/null -m 10 -w "https (http/1.1)              -> %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || echo "https (http/1.1)              -> falhou"
echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null | grep -E "subject=|issuer=" | head -2
h "install.log (últimas 40 linhas)"; tail -40 deploy/install.log 2>/dev/null || echo "(sem log)"
