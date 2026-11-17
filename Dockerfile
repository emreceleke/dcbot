# Bot container'ı.
# DİKKAT: Burada ffmpeg/opus GEREKMEZ — sesi Lavalink işliyor, bot sadece
# komut gönderiyor ve ses gateway payload'larını iletiyor. Bu yüzden imaj küçük,
# RAM kullanımı düşük (~150 MB) ve ücretsiz tierlere rahat sığıyor.
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Önce sadece manifest -> katman önbelleği
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src

# Root olmayan kullanıcı
USER node

CMD ["node", "src/index.js"]
