# Ücretsiz barındırma sağlayıcıları (Kasım 2026)

HeavenCloud free servisini kapattı. Bu liste, yerine geçebilecek **panelli** ücretsiz
sağlayıcıları, hepsinden önemli olan farkla birlikte sıralar:

> **Asıl mesele "renew" (yenileme).** Ücretsiz planların çoğu botu ayakta tutmak için
> her 1-7 günde bir panelden butona basmanı ister. Yenilemezsen bot durur, sonra silinir.
> "Bot bir gün durdu" şikayetlerinin bir numaralı sebebi budur. **Yenileme gerektirmeyen**
> sağlayıcılar bu yüzden üstte.

---

## 1. Kademe — Yenileme YOK, kart YOK (en iyiler)

| Sağlayıcı | RAM | CPU | Disk | Ayakta tutan | Panel |
|---|---|---|---|---|---|
| **FadeHost** <br>`fadehost.com` | 256 MB | 0.25 vCPU | **3 GB** | **Hiçbir şey** — ne renew, ne reklam, ne coin | Kendi paneli (GitHub/upload) |
| **Nylix Host** <br>`nylix.org/host` | **512 MB** (dedicated) | 0.5 vCore | 5 GB NVMe | **Hiçbir şey** — "no delete in 3 days" | Pterodactyl |
| **Quaxly** <br>`quaxly.com` | 512 MB (3 bot paylaşır) | — | — | **Hiçbir şey** | Kendi paneli (upload) |
| **SillyDev** | 256 MB | 25% | 512 MB | **Hiçbir şey** | Pterodactyl |

- **FadeHost** 2011'den beri hosting yapıyor, free planı kalıcı, `FFmpeg + libopus + libsodium`
  runtime'a gömülü, crash doctor + canlı konsol var. Doğrudan doğruladım.
- **Nylix** "dedicated RAM" iddia ediyor (paylaşımlı değil), 3 bölge, 1.800+ bot.
- **Quaxly** tek hesapta 3 bot, shared 512 MB pool.

---

## 2. Kademe — Doğrulama / yenileme ister ama kaynak iyi

| Sağlayıcı | RAM | CPU | Disk | Ayakta tutmak için | Kanca |
|---|---|---|---|---|---|
| **cogithost** <br>`host.cogitdev.net` | **1 GiB** | 75% | 500 MiB | **Her 5 günde doğrulama** | Bot presence'ında **"Hosted by host.cogitdev.net"** yazmak zorunda |
| **Wispbyte** <br>`wispbyte.com` | 512 MB | 35% | 1 GB | **14 günde bir panele giriş** | Panelde reklam engelleyici kapalı olmalı. **Şu an buradayız.** |
| **Daki** <br>`daki.cc` | 512 MB | 50% | 1 GB | **Reklam izleyerek** süre uzat | Almanya, 135k kullanıcı |
| **Falix** <br>`falixnodes.net` | 512 MB | 25% | 2 GB | **Haftalık renew** | Eski ve bilinen sağlayıcı |
| **Kerit Cloud** | 256 MB | 30% | 2 GB NVMe | Haftalık renew | — |
| **ACLClouds** | 315 MB | 0.25 vCPU | 715 MB | 4 günde bir renew | — |

---

## 3. Kademe — Çok küçük, müzik botuna yetmez

| Sağlayıcı | RAM | Neden olmaz |
|---|---|---|
| fps.ms | 128 MB | Bot tek başına ~150 MB ister, OOM |
| Pella | 100 MB | Aynı |
| Discloud | 100 MB | Aynı |

> **RAM eşiği:** bu bot ~150 MB yer. **256 MB minimum**, 512 MB rahat.

---

## Bu bot için öneri

### 🥇 FadeHost
- Yenileme yok → "bot bir gün durdu" problemi yok
- 3 GB disk → node_modules + loglar rahat sığar
- 256 MB → bizim bot (~150 MB) sığar
- GitHub'dan deploy eder, `npm install`'ı kendi çalıştırır
- Env değişkenleri panelden girilir (bizim `config.js` hem `.env` hem panel env'i okuyor)

### 🥈 Nylix
- 512 MB dedicated RAM → iki kat ferah
- Yenileme yok, Pterodactyl panel → alıştığın arayüz

### 🥉 cogithost
- 1 GiB RAM → en ferah
- Ama 5 günde bir doğrulama + zorunlu presence reklamı var

### Yedek: Falix / Daki
Bunlar **haftalık renew** ister. Panelde takvim hatırlatıcısı kur.

---

## Ortak kurulum (hepsinde aynı)

1. Hesap aç (kart istemiyorlar)
2. `dc-music-bot.zip` içeriğini yükle **veya** GitHub reposuna bağla
3. Env değişkenleri:
   ```
   DISCORD_TOKEN · CLIENT_ID · DEV_GUILD_ID
   LAVALINK_HOST=lavalink.jirayu.net
   LAVALINK_PORT=13592
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   SEARCH_PLATFORM=ytmsearch
   ```
4. Başlatma komutu: `node index.js` (veya `npm start`)
5. Konsolda **`npm run doctor`** → ne bozuksa söyler

---

## Müzik (Lavalink) notu

Bu ücretsiz planların hiçbiri botu **ve** Lavalink'i aynı anda taşıyamaz
(Java ~400 MB ister). Bu yüzden:

- **Şimdi:** `.env.example`'daki public Lavalink node'unu kullan (çalışıyor, doğrulandı)
- **Sonra:** ikinci bir ücretsiz sunucu aç (Java 17/21 destekli, örn. Falix) ve
  `lavalink/` klasörünü oraya kur

---

## Doğrulama durumu

| Sağlayıcı | Nasıl doğrulandı |
|---|---|
| FadeHost | Kendi sayfası okundu (Kasım 2026 güncellemesi) ✅ |
| cogithost | Kendi sayfası + ToS okundu ✅ |
| Falix | Kendi sayfası okundu ✅ |
| Nylix, SillyDev, Quaxly | Toplama listelerden — sayfaları açılmadı, **kendin kontrol et** ⚠️ |
| Wispbyte | **Kullanılıyor** — 512 MB / 1 GB / %35 CPU, 14 günde bir giriş şartı ✅ |
| ~~MonkeyBytes~~ | **Listeden çıkarıldı** — hizmet kapanmış ❌ |
| Daki, Kerit, ACLClouds | Bağımsız karşılaştırma tablosundan (3 Kasım 2026) ⚠️ |

Ücretsiz planlar haftalar içinde değişir. Kaydolmadan önce kendi sayfasından teyit et.
