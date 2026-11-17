# DC Music Bot

Discord'da **YouTube** ve **SoundCloud** üzerinden müzik çalan, kendi kendine barınan bot.
Metinle arama, link ile açma, playlist açma ve **benzer şarkı önerme** destekler.

---

## Neden Lavalink?

Bot sesi kendisi işlemez. Çözme/kodlama işini **Lavalink** (ayrı bir Java servisi) yapar;
bot yalnızca komut gönderir. Bunun somut faydaları:

| | Lavalink ile | Bot içinde ffmpeg ile |
|---|---|---|
| Bot RAM'i | ~150 MB | ~400 MB + ffmpeg süreçleri |
| Bot imajında ffmpeg/opus | **gerekmez** | gerekir |
| YouTube bozulunca düzeltme | plugin güncelle | botu yeniden yaz |
| Aynı anda kaç sunucu | onlarca | 2-3 |
| Ücretsiz tier'a sığma | rahat | zor |

2026'da YouTube **PO token** ve Discord **DAVE (uçtan uca şifreleme)** zorunlu hale geldi.
İkisini de Lavalink ekosistemi tek yerde çözüyor:

- **DAVE:** Bot sesi göndermek zorunda olduğu için DAVE desteği şart. `@discordjs/voice` 0.19.x'in
  DAVE implementasyonu **ses alma** tarafında bozuk (issue #11419) — ama bu bot ses *almıyor*,
  sadece *gönderiyor*. Lavalink ise 4.2+ sürümlerinde DAVE'i tam destekliyor.
- **PO token:** `youtube-source` plugin'i OAuth, `poToken` ve uzak cipher sunucusu seçeneklerini sunuyor.

---

## Mimari

```
┌──────────────────────┐   REST + WS   ┌────────────────────────────┐
│  bot (Node.js)       │ ────────────► │  Lavalink v4 (Java 17+)    │
│  discord.js 14       │ ◄──────────── │  youtube-source plugin     │
│  lavalink-client     │               │  SoundCloud (yerleşik)     │
└──────────┬───────────┘               └──────────────┬─────────────┘
           │ WSS                                       │ HTTPS
           ▼                                           ▼
   Discord Gateway                            YouTube / SoundCloud
   (komutlar, ses state)                      (ses akışı)
```

Bot **kalıcı bir proses** olmak zorundadır: Discord Gateway sürekli açık bir WebSocket
bağlantısı ister. Bu yüzden Vercel / Netlify / Cloudflare Workers **kullanılamaz**
(ayrıntı: [`docs/barindirma.md`](docs/barindirma.md)).

---

## Kurulum (yerel)

```powershell
npm install
Copy-Item .env.example .env
# .env'i düzenle: DISCORD_TOKEN, CLIENT_ID ve LAVALINK_* alanları
npm run check     # yapılandırmayı ve komutları doğrular (ağ gerekmez)
npm start
```

### Yerelde Lavalink olmadan test

Makinenizde Java 17 veya Docker yoksa ücretsiz bir **public Lavalink node**'una bağlanıp
test edebilirsiniz. Güncel listeler:

- <https://lavalink.darrennathanael.com>
- <https://github.com/AjieDev/Free-Lavalink>

`.env` içine o node'un host/port/şifre bilgilerini yazın. Public node'lar paylaşımlıdır:
test için iyidir, üretim için **kendi node'unuzu** kurun.

### Discord tarafı

1. <https://discord.com/developers/applications> → **New Application**
2. **Bot** sekmesi → token'ı kopyala (`.env` → `DISCORD_TOKEN`)
3. **General Information** → Application ID (`.env` → `CLIENT_ID`)
4. **Privileged Gateway Intents** → hiçbirini açmanız **gerekmez**.
   Bot yalnızca `Guilds` ve `GuildVoiceStates` kullanır.
5. Botu sunucuya davet et (OAuth2 URL Generator → `bot` + `applications.commands`):
   `Connect`, `Speak`, `View Channel`, `Send Messages`, `Embed Links` izinleri.

Geliştirme sırasında `DEV_GUILD_ID` doldurursanız slash komutlar **anında** görünür;
boş bırakırsanız global kaydedilir ve yayılması ~1 saat sürebilir.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `/play <sorgu>` | Şarkı adı, YouTube/SoundCloud linki veya **playlist linki** |
| `/similar [adet]` | Çalan parçaya benzeyen şarkıları kuyruğa ekler |
| `/autoplay [acik]` | Kuyruk bitince benzer şarkılarla devam etmeyi açar/kapatır |
| `/queue [sayfa]` | Kuyruğu gösterir |
| `/nowplaying` | Çalan parça + ilerleme çubuğu |
| `/pause` | Duraklat / devam et |
| `/skip [adet]` | Atlar |
| `/stop` | Durdurur, kuyruğu temizler, kanaldan çıkar |
| `/volume [seviye]` | Ses seviyesi (0-150) |
| `/shuffle` | Kuyruğu karıştırır |
| `/help` | Komut listesi |

### Arama kaynağını elle seçmek

Sorguya kaynak öneki yazabilirsiniz (Lavalink sözdizimi):

```
/play scsearch:lofi hip hop       → SoundCloud'da ara
/play ytsearch:konuşma            → YouTube'da ara (video ağırlıklı)
/play ytmsearch:album adı         → YouTube Music'te ara (varsayılan)
```

---

## Öneri motoru

İki katmanlı, ikisi de ücretsiz:

1. **Last.fm** (`track.getSimilar`) — dinleme verisine dayalı, en isabetli.
   Ücretsiz anahtar: <https://www.last.fm/api/account/create> → `.env` → `LASTFM_API_KEY`
2. **YouTube Radio mix** (`RD<videoId>`) — anahtar gerekmez, YouTube'un kendi "up next" listesi.

Anahtar yoksa bot otomatik olarak 2. katmana düşer. `/similar` çıktısının altında hangi
kaynağın kullanıldığı yazar.

> **Not:** Spotify'ın `recommendations` ve `related-artists` endpoint'leri 27 Kasım 2024'te
> yeni uygulamalara kapatıldı. Bu yüzden Spotify yerine Last.fm kullanılıyor.

---

## Spotify neden yok?

Kullanıcı isteğiyle tamamen çıkarıldı — ve teknik olarak da doğru karar:

- Spotify API **hiçbir zaman ses akışı vermez**, sadece metadata verir.
- 27 Kas 2024: `recommendations`, `related-artists`, `audio-features`, 30 sn önizleme kaldırıldı.
- 11 Şub 2026 (mevcut uygulamalar 9 Mart 2026): Development Mode için **Spotify Premium zorunlu**,
  1 client ID, 5 kullanıcı, endpoint daraltması. "Client Credentials'tan uzaklaşma" başladı.

Yani Spotify'dan müzik çalmak zaten mümkün değildi; link → metadata → YouTube eşleştirme
zinciri ise her ay bozulacak ekstra bir kırılganlık katmanı olurdu.

Spotify linki yapıştırılırsa bot kibar bir mesajla YouTube/SoundCloud'a yönlendirir.

---

## Barındırma

Detaylı karşılaştırma: [`docs/barindirma.md`](docs/barindirma.md)
Adım adım dağıtım: [`deploy/northflank.md`](deploy/northflank.md)

**Kısa özet:**

| Seçenek | Kart | Uyumaz/silinir mi | Uygunluk |
|---|---|---|---|
| **Northflank Sandbox** | **Evet** (kimlik doğrulama; harcama yapmadıkça çekim yok) | Hayır (always-on) | 🥇 2 servis (bot + Lavalink), ayda $20'ye kadar ücretsiz kaynak |
| Oracle Cloud Always Free | Evet | Kapasite sıkıntısı + idle reclaim | 🥈 En güçlü donanım, ama kurulum savaşı |
| Falix / FPS.ms / Daki | Hayır | Haftalık/günlük renew | 🥉 Yedek plan (Pterodactyl sınıfı) |
| Vercel / Netlify / CF Workers | — | — | ❌ Mimari olarak imkânsız |

> **Kart konusunda dürüst olalım:** ücretsiz + 7/24 + always-on + **kartsız** dörtlüsünü
> birlikte sağlayan güvenilir bir sağlayıcı yok. Kart vermeyi reddediyorsanız Pterodactyl
> sınıfına (Falix vb.) düşersiniz — o da HeavenCloud'un sınıfı. Ayrıntı: [`docs/barindirma.md`](docs/barindirma.md)

---

## Sorun giderme

| Belirti | Sebep / çözüm |
|---|---|
| Bot ses kanalına giriyor ama **ses yok** | Lavalink düğümüne bağlanılamıyor. Log'da `Lavalink düğümü` satırına bak; `LAVALINK_HOST/PORT/PASSWORD` doğru mu? |
| `/play` → "Sonuç bulunamadı" | Kaynak öneki dene (`ytsearch:`), veya düğümde YouTube plugin'i çalışmıyor |
| "Sign in to confirm you're not a bot" | `lavalink/application.yml` içindeki **poToken** veya **OAuth** bölümünü aç (dosyada açıklaması var) |
| Parça yarıda kesiliyor | Düğümün CPU/RAM'i yetmiyor; `-Xmx384m` değerini yükselt veya planı büyüt |
| Komutlar görünmüyor | `DEV_GUILD_ID` doldur (anında) ya da global kayıt için ~1 saat bekle |
| Bot çevrimiçi ama komutlar eski | Discord istemcisinde `Ctrl+R` |

Log seviyesini `LOG_LEVEL=debug` yaparak detay görebilirsiniz.

---

## Proje yapısı

```
src/
  index.js              bot önyükleme, komut yükleyici, olay yönlendirme
  config.js             ortam değişkenleri + logger
  music/
    lavalink.js         LavalinkManager kurulumu ve düğüm olayları
    player.js           player oluşturma/bağlama, DJ kontrolü, son çalan parça
    resolve.js          sorgu → Lavalink identifier, sonuç sınıflandırma
    embeds.js           embed/format yardımcıları
    settings.js         sunucu bazlı ayarlar (autoplay)
  recommend/
    lastfm.js           Last.fm çağrıları, başlık ayrıştırma, radio-mix URL'i
    engine.js           öneri stratejisi + autoplay
  commands/             11 slash komutu (her biri kendi dosyasında)
scripts/check.js        uçuş öncesi doğrulama (npm run check)
lavalink/               application.yml + Dockerfile
deploy/                 barındırma rehberleri
```

---

## Ayarlar

Tümü `.env` üzerinden. Tam liste ve açıklamalar: [`.env.example`](.env.example)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `SEARCH_PLATFORM` | `ytmsearch` | `ytmsearch` / `ytsearch` / `scsearch` |
| `DEFAULT_VOLUME` | `80` | Katılınca ayarlanan ses |
| `MAX_PLAYLIST_SIZE` | `100` | Tek playlist'ten alınacak en fazla parça |
| `AUTOPLAY` | `true` | Kuyruk bitince öneriyle devam |
| `LASTFM_API_KEY` | — | Boşsa yalnızca YouTube mix kullanılır |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
