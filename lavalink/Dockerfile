# Lavalink v4 — ses motoru.
# Yerleşik imajı alıp kendi application.yml'imizi üstüne yazıyoruz.
FROM ghcr.io/lavalink-devs/lavalink:4

# Kendi yapılandırmamız (youtube-source plugin'i burada devreye giriyor).
COPY application.yml /opt/Lavalink/application.yml

ENV _JAVA_OPTIONS="-Xmx384m"

EXPOSE 2333

# Sağlık kontrolü: Lavalink v4 /version döner.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["/bin/sh", "-c", "wget -qO- http://127.0.0.1:2333/version || exit 1"]
