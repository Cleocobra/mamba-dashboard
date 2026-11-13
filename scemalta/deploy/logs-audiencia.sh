#!/usr/bin/env bash
# SC em Alta — quantos dias de log existem e IPs unicos por dia do scemalta.com.br.
# Somente leitura. Uso: bash logs-scemalta.sh [nome-do-container-nginx]
#
# Este script se recusa a responder quando o formato do log nao permite responder.
# Isso e proposital: o log 'combined' padrao do nginx NAO grava o host, e contar
# por 'grep scemalta.com.br' acaba casando so o campo Referer, o que perde todas as
# visitas de entrada e conta visitantes de OUTROS sites do mesmo nginx.
set -uo pipefail

DOM='scemalta.com.br'
C="${1:-leadspanel-nginx-1}"

if ! docker inspect "$C" >/dev/null 2>&1; then
  echo "Container '$C' nao existe. Candidatos:"
  docker ps --format '{{.Names}}' | grep -i -E 'nginx|proxy|caddy|traefik' || docker ps --format '{{.Names}}'
  echo "Rode de novo: bash $0 <nome-do-container>"
  exit 1
fi

TMP=$(mktemp); trap 'rm -f "$TMP" "$TMP.err"' EXIT
if ! docker logs "$C" --since 720h > "$TMP" 2>"$TMP.err"; then
  echo "docker logs falhou:"; head -3 "$TMP.err"; exit 1
fi
LINHAS=$(wc -l < "$TMP")

# ── analisador comum ────────────────────────────────────────────────────────────
# -F'"' no formato combined: $1="IP - - [data] " $2=request $4=referer $6=user-agent
# A data e o IP sao localizados por formato, nunca por posicao fixa, porque um
# log_format com $host na frente desloca todos os campos.
AWKLIB='
function iso(f,  m,p){ m="JanFebMarAprMayJunJulAugSepOctNovDec";
  p=index(m,substr(f,5,3)); if(p==0) return "";
  return substr(f,9,4) "-" sprintf("%02d",(p+2)/3) "-" substr(f,2,2) }
function datade(pre,  n,f,i){ n=split(pre,f,/[ \t]+/);
  for(i=1;i<=n;i++) if(f[i] ~ /^\[[0-9][0-9]\//) return iso(f[i]); return "" }
function ipde(pre,  n,f,i){ n=split(pre,f,/[ \t]+/);
  for(i=1;i<=n;i++) if(f[i] ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ || f[i] ~ /^[0-9a-fA-F]*:[0-9a-fA-F:]+$/) return f[i]; return "" }
function temhost(dom,  n,f,i,j){ n=split($1,f,/[ \t]+/);
  for(i=1;i<=n;i++) if(f[i]==dom || f[i]=="www." dom) return 1;
  for(j=7;j<=NF;j++){ n=split($j,f,/[ \t]+/);
    for(i=1;i<=n;i++) if(f[i]==dom || f[i]=="www." dom) return 1 } return 0 }
function ehbot(ua){ return tolower(ua) ~ /(^|[^a-z])(bot|crawler?|spider|slurp)([^a-z]|$)|facebookexternalhit|whatsapp|bingpreview|curl\/|wget|python-requests|go-http-client|headlesschrome/ }
'

echo "### 1. Quantos dias de log existem"
awk -F'"' "$AWKLIB"'{ d=datade($1); if(d!="") print d }' "$TMP" | sort -u > "$TMP.d"
NDIAS=$(wc -l < "$TMP.d")
echo "    linhas no buffer do Docker : $LINHAS"
echo "    dias com data reconhecida  : $NDIAS"
if [ "$NDIAS" -gt 0 ]; then
  echo "    intervalo                  : $(head -1 "$TMP.d") .. $(tail -1 "$TMP.d")"
elif [ "$LINHAS" -gt 0 ]; then
  echo "    !! Nenhuma data no formato do nginx. O log nao parece ser de acesso. Amostra:"
  head -2 "$TMP" | sed 's/^/       /'
  rm -f "$TMP.d"; exit 1
fi
rm -f "$TMP.d"
echo "    (isso e o que o Docker ainda guarda, nao a idade do site. Rotacao:"
echo "     $(docker inspect --format '{{json .HostConfig.LogConfig}}' "$C" 2>/dev/null))"

echo
echo "### 2. Da para separar o que e do $DOM?"
COMHOST=$(awk -F'"' "$AWKLIB"'temhost("'"$DOM"'"){n++} END{print n+0}' "$TMP")
echo "    linhas com o host num campo proprio: $COMHOST"

if [ "$COMHOST" -eq 0 ]; then
  echo
  echo "    NAO. O log_format em uso nao grava o host da requisicao."
  echo "    Amostra de uma linha:"
  head -1 "$TMP" | cut -c1-160 | sed 's/^/       /'
  REF=$(grep -cF "$DOM" "$TMP")
  echo
  echo "    Atencao: existem $REF linha(s) contendo '$DOM', mas apenas no campo Referer."
  echo "    Contar por elas da um numero ERRADO com cara de certo: perde toda visita de"
  echo "    entrada (referer vazio ou vindo do Google) e inclui gente que so clicou num"
  echo "    link do $DOM para ir a OUTRO site deste mesmo nginx. Por isso nao conto."
  echo
  echo "    Procurando um access_log por site dentro do container:"
  docker exec "$C" sh -c 'ls -la /var/log/nginx/ 2>/dev/null' 2>/dev/null | sed 's/^/       /' \
    || echo "       (nao consegui listar /var/log/nginx no container)"
  echo
  echo "    Para passar a medir por site, no nginx:"
  echo "       log_format vhost '\$host \$remote_addr - \$remote_user [\$time_local] '"
  echo "                        '\"\$request\" \$status \$body_bytes_sent '"
  echo "                        '\"\$http_referer\" \"\$http_user_agent\"';"
  echo "       access_log /var/log/nginx/access.log vhost;"
  echo "    ou um access_log proprio dentro do server block do $DOM."
  echo "    Daqui para frente, a medicao certa vem do GA4 (G-XCHEE64M53)."
  exit 0
fi

echo "    Sim. Contando por campo de host, nao por Referer."
echo
echo "### 3. IPs unicos por dia do $DOM (bots filtrados so pelo user-agent)"
printf '    %-12s %s\n' DATA IPS
awk -F'"' "$AWKLIB"'
  temhost("'"$DOM"'") {
    ua = (NF>=6 ? $6 : "")
    if (ehbot(ua)) next
    d = datade($1); ip = ipde($1)
    if (d!="" && ip!="") print d, ip
  }' "$TMP" | sort -u \
  | awk '{c[$1]++} END{for(d in c) printf "    %-12s %s\n", d, c[d]}' | sort
echo
echo "    (IP unico nao e pessoa: celular troca de IP e uma casa compartilha um.)"
echo "    (Se houver Cloudflare ou outro proxy na frente, o IP aqui e o do proxy.)"
