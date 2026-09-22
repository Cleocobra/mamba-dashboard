#!/bin/sh
# Agendador do SC em Alta (roda dentro do container "scheduler").
apk add --no-cache curl tzdata >/dev/null 2>&1
mkdir -p /etc/crontabs /var/log
cat > /etc/crontabs/root <<CRON
0 ${RUN_HOUR:-6} * * *     curl -s -m 600 -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://scemalta-app:3000/api/run     >> /var/log/scemalta.log 2>&1
0 ${PUBLISH_HOUR:-8} * * * curl -s -m 600 -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://scemalta-app:3000/api/publish >> /var/log/scemalta.log 2>&1
CRON
echo "scheduler: gerar às ${RUN_HOUR:-6}h, publicar às ${PUBLISH_HOUR:-8}h ($(date))"
touch /var/log/scemalta.log
crond -f -l 6 &
tail -F /var/log/scemalta.log
