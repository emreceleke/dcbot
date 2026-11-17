#!/bin/sh
# Pterodactyl / panel başlatma betiği.
#
# Panelde "Başlatma komutu" alanına şunu yaz:
#     sh start.sh
# veya
#     bash start.sh
#
# Ne yapar:
#   1. Node sürümünü yazar (panelde doğru sürüm var mı görmek için)
#   2. node_modules yoksa npm install çalıştırır
#   3. Ortam değişkenlerini raporlar
#   4. Botu başlatır

echo "================================================================"
echo "  DC Music Bot - panel başlatıcı"
echo "================================================================"

echo "[boot] Node.js : $(node -v 2>/dev/null || echo 'BULUNAMADI')"
echo "[boot] npm     : $(npm -v 2>/dev/null || echo 'BULUNAMADI')"
echo "[boot] Dizin   : $(pwd)"
echo "[boot] Bellek  : $(free -m 2>/dev/null | awk '/Mem:/ {print $7" MB kullanılabilir"}' || echo 'bilinmiyor')"

if ! command -v node >/dev/null 2>&1; then
  echo "[boot] HATA: Node.js bulunamadı. Panelin Node.js egg'i ile bu sunucuyu kurmalısın."
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
  echo "[boot] HATA: Node.js $(node -v) çok eski. En az 18 gerekir."
  echo "[boot]       Panelden Node.js sürümünü yükselt (18/20/22)."
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d node_modules/discord.js ]; then
  echo "[boot] node_modules eksik, kuruluyor..."
  npm install --omit=dev --no-audit --no-fund || {
    echo "[boot] HATA: npm install başarısız oldu. Yukarıdaki çıktıya bak."
    exit 1
  }
else
  echo "[boot] Bağımlılıklar kurulu."
fi

echo "[boot] Bot başlatılıyor..."
echo "================================================================"

exec node index.js
