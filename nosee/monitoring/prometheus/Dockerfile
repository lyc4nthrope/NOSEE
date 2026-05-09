FROM prom/prometheus:v2.47.0

# Copia la config como template — las credenciales se inyectan en start.sh
COPY prometheus.cloud.yml /etc/prometheus/prometheus.yml.template
COPY start.sh /start.sh

USER root
RUN chmod +x /start.sh

EXPOSE 9090

ENTRYPOINT ["/start.sh"]
