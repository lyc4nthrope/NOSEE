#!/bin/sh
# start.sh — sustituye variables de entorno en la config de Prometheus antes de arrancar.
# Las variables REMOTE_WRITE_URL, REMOTE_WRITE_USERNAME y REMOTE_WRITE_PASSWORD
# se configuran en el HF Space (Settings → Variables and secrets) y nunca
# quedan guardadas en el repositorio de GitHub.

sed -e "s|REMOTE_WRITE_URL|${REMOTE_WRITE_URL}|g" \
    -e "s|REMOTE_WRITE_USERNAME|${REMOTE_WRITE_USERNAME}|g" \
    -e "s|REMOTE_WRITE_PASSWORD|${REMOTE_WRITE_PASSWORD}|g" \
    /etc/prometheus/prometheus.yml.template > /etc/prometheus/prometheus.yml

exec /bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.console.libraries=/usr/share/prometheus/console_libraries \
  --web.console.templates=/usr/share/prometheus/consoles \
  --web.listen-address=:9090
