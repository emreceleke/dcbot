# Barındırma araştırması

Bu belge "ücretsiz çalışır mı" sorusunun kanıtlı cevabını içerir. Bugün: **17 Kasım 2026**.

---

## 1. Neden Vercel / Netlify / Cloudflare Workers çalışmaz

Üç ayrı, birbirinden bağımsız engel var. Herhangi biri tek başına yeterli.

### 1.1 Discord Gateway kalıcı bağlantı ister

Bot, `wss://gateway.discord.gg` adresine **sürekli açık** bir WebSocket tutmak zorundadır.
Komutlar, ses durumu güncellemeleri, kanal değişiklikleri bu bağlantıdan gelir.

- **Vercel Functions / Netlify Functions** istek bitince ölür. Sunucu tarafı WebSocket
  sunucusu yoktur.
- Yalnızca "interactions-only" mimari (sadece slash komut HTTP endpoint'i) sunucu tarafı WS
  olmadan çalışır; ama bot **hangi ses kanalına katılacağını** gateway'den öğrendiği için
  ses özelliği kaybolur.

### 1.2 Ses UDP gerektirir

Discord'a ses göndermek, seçilen ses bölgesine **7/24 açık bir UDP soketi** + Opus RTP
paketleri demektir. Cloudflare Workers (V8 isolate) ve Vercel/Netlify fonksiyonlarında
UDP soketi **yoktur**. Bu teknik olarak gönderilemez.

### 1.3 Cloudflare'ın kendine özel iki kırıcı sorunu

| Kaynak | Sorun |
|---|---|
| discord-api-docs **#7146** | Workers çıkış IP'leri (`2a06:98c0:3600::103` vb.) Discord'un Cloudflare rate-limit kuralına takılıyor → `429 / 1015`. Etkilenen datacenter'lar arasında FRA, CDG, WAW, GRU var. |
| discord-api-docs **#6145** | Discord Gateway API, Workers'ın çıkış IP'sini **doğrudan reddediyor** ("The egress IP for cloudflare workers is rejected by Discord's Gateway API"). Discord tarafı bunu "çalışıldığı gibi" kapatmadı. |

Durable Objects bir WebSocket tutabilir, ama (a) egress IP yine engelli, (b) UDP yok.
Yani DO bu problemi çözmez.

### 1.4 Native bağımlılıklar

ffmpeg, yt-dlp, Java/Lavalink bir serverless runtime'a kurulamaz. Dosya sistemi geçici,
zaman aşımı 10-60 sn.

> **Sonuç:** Ses çalan bir Discord botu **kalıcı bir proses** gerektirir. Alternatif yok.

---

## 2. Gerçekten ücretsiz seçenekler

| Seçenek | Ücretsiz ne veriyor | Kart | Always-on | Not |
|---|---|---|---|---|
| **Northflank Sandbox** | 2 servis + 1 DB, ayda **$20'ye kadar** kaynak | **Gerekir** ⚠️ | ✅ No sleeping | Kendi dokümanı: "all users must add a payment method… regardless of plan selection". Pricing sayfasındaki "No card needed" yanıltıcı |
| **Oracle Cloud Always Free** | ARM A1: **2 OCPU / 12 GB** (Haz 2026'da 4/24'ten düşürüldü), 10 TB/ay egress, 200 GB disk | Gerekir | ✅ | En güçlü donanım. Kapasite + idle reclaim riski (bkz. §3) |
| **Kendi PC / Raspberry Pi** | Sınırsız | — | ✅ | Elektrik/internet bağımlı. Gerçekten bedava |
| **Google Cloud Always Free** | e2-micro (1 GB RAM), 3 ABD bölgesi, **1 GB/ay egress** | Gerekir | ✅ | 1 GB egress ≈ ~35 saat yayın. Çok sıkı |
| **Falix / FPS.ms / Daki / lunes.host** (Pterodactyl) | 128-512 MB RAM, 0.25-2 GB disk | Gerekmez | ✅ ama **renew şart** (24 saat / 7 gün) | Java 17/21 var → Lavalink çalışır |
| **Discloud** | 1 bot, **100 MB RAM** | Gerekmez | ✅ | Lavalink imkânsız; bot tek başına da sınırda |
| **Koyeb** | 1 servis, 512 MB, 0.1 vCPU, scale-to-zero | Gerekir (+$29 ön provizyon) | ❌ uyur | |
| **Fly.io** | — | — | — | Free tier **Ekim 2024'te kaldırıldı** |
| **Render** | 750 instance-saat/ay, 15 dk sonra uyur | Gerekmez | ❌ | |
| **Railway** | 30 gün $5 deneme, sonra ayda $1 kredi | Gerekmez | ❌ | |
| **SnapDeploy** | 4 container, **100 saat/ay** | Gerekmez | ❌ | Ayda 100 saat ≠ 7/24 |
| **Vercel / Netlify / CF Workers** | — | — | ❌ | Bkz. §1 |

---

## 3. Oracle: "out of host capacity" neden bu kadar yaygın

Üç sebep aynı anda çalışıyor:

1. **Kota küçüldü.** Always Free ARM A1 = tenancy başına **1.500 OCPU-saat + 9.000 GB-saat/ay**
   → yani **2 OCPU / 12 GB**. Oracle bunu **15 Haziran 2026'da** duyurusuz olarak
   4 OCPU/24 GB'tan düşürdü. PAYG'ye geçen hesaplarda eski 4/24 kalmış görünüyor.
2. **Arz yok.** Hata mesajı = home region'da o anda boş Always Free A1 kapasitesi yok.
   Free tier aşırı popüler; bazı bölgelerde tek Availability Domain var.
3. **Öncelik PAYG'de.** Ücretsiz hesaplar kapasite kuyruğunun sonunda; PAYG kullanıcılar
   önce alıyor.

### Çözümler (etkinlik sırasına göre)

1. Farklı **Availability Domain** dene (`Chuncheon` hariç).
2. **Retry script** çalıştır:
   - <https://github.com/hitrov/oci-arm-host-capacity>
   - <https://github.com/alexpua/oci-arm-catcher>
   Günler sürebilir ama sonunda yakalar.
3. **PAYG'ye upgrade et.** Always Free limitleri içinde kalırsan fatura gelmez; kapasite
   önceliği kazanırsın. **Budget alert kurun** — tek sigorta bu.
4. Tenancy'e **ikinci home region** ekle (bağımsız kapasite havuzu).

### Ek risk: idle reclaim

Oracle, 7 gün boyunca **CPU %95-persentil <%20** ve **network <%20** olan instance'ları
geri alabilir. Büyük bir instance'ta küçük bir bot bu eşiğin altında kalabilir →
instance'ı ihtiyacın kadar küçük tut veya PAYG'de tut.

---

## 4. Seçilen yığının kaynak profili

| Bileşen | RAM | vCPU | Not |
|---|---|---|---|
| Bot (Node.js) | ~120-200 MB | paylaşımlı | ffmpeg/opus **yok** |
| Lavalink (`-Xmx384m`) | ~350-500 MB | 0.25-0.5 | Tek ses kanalı için fazlasıyla yeterli |
| **Toplam** | **~0.5-0.7 GB** | **~0.5** | Bir 512 MB + bir 256 MB servise sığar |

### Northflank maliyet hesabı (ücretsiz $20/ay limitine karşı)

Fiyatlandırma: `$0.01667/vCPU-saat` + `$0.00833/GB-saat` + `$0.06/GB egress`, ayda 730 saat.

| Servis | Plan | Aylık |
|---|---|---|
| bot | `nf-compute-10` (0.1 vCPU / 256 MB) | $1.22 + $1.52 = **$2.74** |
| lavalink | `nf-compute-20` (0.2 vCPU / 512 MB) | $2.43 + $3.04 = **$5.47** |
| **Compute toplamı** | | **$8.21** |

**Network egress** ayrıca sayılır. Discord sesi ~128 kbps ≈ **57.6 MB/saat**:

| Kullanım | Aylık egress | Maliyet |
|---|---|---|
| Günde 4 saat | ~7 GB | $0.42 |
| 7/24 kesintisiz | ~42 GB | $2.52 |

**En kötü senaryo toplam: ~$10.73** → $20 limitinin rahat içinde. ✅

Lavalink'i `nf-compute-50`'ye (0.5 vCPU / 1 GB, $12.00/ay) çıkarsan toplam ~$14.74 olur, hâlâ sığar.

> ⚠️ Ücretsiz planlar sık değişir. Dağıtımdan önce sağlayıcının güncel fiyat sayfasını
> doğrula. Bu belgedeki rakamlar 17 Kasım 2026 tarihine aittir.

---

## 4b. Kart gerçeği — dürüst tablo

"Ücretsiz" vaat eden ciddi sağlayıcıların **hepsi** kart ister, çünkü kart kimlik
doğrulaması ve kötüye kullanım engelleme aracıdır:

| Sağlayıcı | Kart | Kaynak |
|---|---|---|
| Northflank | **Evet** | *"all users must add a payment method… regardless of plan selection"* — kendi dokümanı |
| Oracle | Evet | Kayıt sırasında kart doğrulaması |
| Google Cloud | Evet | *"A Google Cloud billing account is required to access the Free Tier"* |
| Koyeb | Evet + $29 ön provizyon | Fiyatlandırma SSS |
| Fly.io | (free tier yok) | Ekim 2024'te kaldırıldı |

Kartsız kalan seçenekler:

| Sağlayıcı | Neden yetersiz |
|---|---|
| Falix / FPS.ms / Daki / lunes.host | Pterodactyl sınıfı = HeavenCloud'un sınıfı. Renew derdi + değişken kalite |
| Discloud | 100 MB RAM — Lavalink imkânsız |
| SnapDeploy | 100 saat/ay — 7/24 değil |
| Render | 15 dk sonra uyur (kartsız ama always-on değil) |
| Railway | 30 gün $5 deneme, sonra $1/ay kredi |
| Hugging Face Spaces | 48 saat hareketsizlikte uyur |

**Sonuç:** `ücretsiz` + `7/24 always-on` + `kartsız` + `güvenilir` dörtlüsünü birlikte
sağlayan bir seçenek **yok**. Birinden feragat etmek gerekiyor. Önerilen feragat: kart
(kimlik doğrulama amaçlı, harcama yapmadıkça çekim olmaz + billing alert).

---

## 5. Kaynak / kanıt listesi

- discord-api-docs #7146 — Workers IP'leri Discord'da rate-limit'e takılıyor
- discord-api-docs #6145 — Discord Gateway Workers egress IP'sini reddediyor
- discord.js #11419 — `@discordjs/voice` 0.19.x DAVE ses **alma** hatası (gönderme çalışıyor)
- discord.com/blog/bringing-dave-to-all-discord-platforms — 1 Mart 2026'dan itibaren E2EE zorunlu
- lavalink-devs/youtube-source — plugin yapılandırması, PO token, OAuth, cipher sunucusu
- Spotify developer blog 2024-11-27 + 2026-02-06 — endpoint kaldırma ve Development Mode kısıtları
- Oracle docs "Always Free Resources" + FAQ — kapasite hatası ve idle reclaim
- Northflank pricing — Sandbox: kart yok, always-on, $20/ay kaynak
- Groovy/Rythm 2021 YouTube cease & desist — ölçeklenirse hukuki risk gerçek
