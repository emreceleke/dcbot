# Pterodactyl panellerine kurulum (Falix / Daki / FPS.ms / HeavenCloud…)

Bu rehber, "bot yükledim ama **hiç tepki vermiyor**" sorununu çözmek için yazıldı.
Aşağıdaki 6 sebep, bu sınıf panellerdeki başarısızlıkların neredeyse tamamıdır.

---

## 0. Önce hatayı GÖR

Sessiz ölümün tek sebebi: kimse konsola bakmıyor. Panele gir ve **Console** sekmesini aç.
Bot çöktüğünde orada kırmızı satırlar olur. O satırlar olmadan teşhis yapılamaz.

Bu proje artık **asla sessizce ölmez** — her hata, ne olduğunu söyleyen bir blok basar:

```
================================================================
  YAPILANDIRMA HATASI
================================================================
  Zorunlu ortam değişkeni eksik: DISCORD_TOKEN
  → Discord Developer Portal → Bot → Reset Token ile al, panelde
    "DISCORD_TOKEN" olarak ekle.
================================================================
  Teşhis:  npm run doctor
================================================================
```

Bu bloğu görüyorsan sorun belli demektir. Görüyorsan ve ne yapacağını bilmiyorsan,
çıktının tamamını bana yapıştır — yeter.

---

## 1. Kurulum adımları (sırayla)

### Adım 1 — Sunucuyu doğru egg ile aç

Panelde yeni sunucu oluştururken **Node.js** egg'ini seç. Java egg'i seçersen Node çalışmaz.

| Sağlayıcı | Ücretsiz RAM | Lavalink nerede? |
|---|---|---|
| Falix | 512 MB | Ayrı sunucu gerekir |
| Daki | 512 MB | Ayrı sunucu gerekir |
| FPS.ms | 128 MB | **Çok küçük** — bot tek başına sınırda |
| HeavenCloud | 512 MB | Ayrı sunucu gerekir |

> **RAM gerçeği:** Bot tek başına ~150 MB yer. **128 MB'lık ücretsiz planlarda
> çalışmaz** — exit code 137 (OOM) alırsın. En az 256 MB, ideal 512 MB.

### Adım 2 — Dosyaları yükle

İki yol var:

**A) Zip yükleme (kolay):** Panel → File Manager → `node_modules`, `.git`
hariç projeyi zip'le ve yükle → sağ tık → **Unarchive**.

**B) Git (daha iyi):** Panel konsolunda:
```sh
git clone https://github.com/<kullanıcı>/<repo>.git .
```

### Adım 3 — `.env` dosyasını oluştur ← EN SIK ATLANAN ADIM

`.env` **commit edilmez** (`.gitignore` içinde), o yüzden sunucuda **yoktur**.
Bu proje `.env` dosyasını kendisi okur (harici bağımlılık yok), yani panelden
değişken girmekle uğraşmana gerek yok — dosyayı oluştur, yeter.

File Manager → yeni dosya → adı `.env` → içine:

```env
DISCORD_TOKEN=buraya_bot_token
CLIENT_ID=buraya_application_id
DEV_GUILD_ID=test_sunucu_id

LAVALINK_HOST=lavalink.jirayu.net
LAVALINK_PORT=13592
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_NAME=jirayu

SEARCH_PLATFORM=ytmsearch
AUTOPLAY=true
LOG_LEVEL=info
```

Tam liste ve açıklamalar: `.env.example`

> `DEV_GUILD_ID` doldur → komutlar **anında** görünür. Boş bırakırsan global
> kaydedilir ve yayılması 1 saate kadar sürebilir. "Komutlar görünmüyor"
> şikayetinin en yaygın sebebi budur.

### Adım 4 — Bağımlılıkları kur

Panel konsolunda:
```sh
npm install --omit=dev
```

Bunu atlarsan `Cannot find module 'discord.js'` alırsın ve bot anında ölür.

### Adım 5 — Teşhis çalıştır ← BU ADIMI ATLAMA

```sh
npm run doctor
```

Çıktı sana **tam olarak** neyin çalışıp neyin çalışmadığını söyler:

```
1. Çalışma ortamı
  ✓ Node.js v22.x
  ✓ Bağımlılıklar kurulu
2. Yapılandırma
  ✓ Zorunlu değişkenler okundu
3. Discord token biçimi
  ✓ Token biçimi geçerli
4. Lavalink düğümüne erişim
  ✓ TCP bağlantısı kuruldu
5. Lavalink REST API
  ✓ Lavalink sürümü: 4.x.x
6. Uçtan uca arama testi
  ✓ Müzik araması çalışıyor: "..." (search)

✓ Teşhis tamam: kritik sorun yok.
```

Kritik bir şey bozuksa `✗` ile işaretlenir ve ne yapılacağı yazılır.

### Adım 6 — Başlat

Panel konsolunda:
```sh
node index.js
```
veya panelin **Start** düğmesi (başlatma komutu `node index.js` /
`npm start` / `sh start.sh` — üçü de çalışır).

Başarılı çıktı:
```
────────────────────────────────────────────────────────────────
  DC Music Bot
────────────────────────────────────────────────────────────────
  Node.js       : v22.x
  Discord token : MTAx…(72 karakter)
  Lavalink      : lavalinkv4.serenetia.com:443 (secure=true)
────────────────────────────────────────────────────────────────
[info]  11 komut yüklendi.
[info]  Discord'a bağlanılıyor...
[info]  Giriş yapıldı: BotAdı#1234
[info]  Lavalink düğümüne bağlandı: public
[info]  11 komut 123… sunucusuna kaydedildi (anında).
[info]  Bot hazır. Discord'da /play yazarak başla.
```

---

## 2. "Tepki vermiyor" — sebep → çözüm tablosu

| Konsolda ne görüyorsun | Sebep | Çözüm |
|---|---|---|
| Hiçbir şey, boş | Başlatma komutu çalışmıyor / main file yanlış | Startup ayarında komutu `node index.js` yap. Kök dizinde `index.js` var. |
| `SyntaxError: Unexpected token` | Node sürümü çok eski | Konsolda `node -v` → 18'den küçükse panelden sürüm yükselt |
| `Cannot find module 'discord.js'` | `npm install` yapılmadı | `npm install --omit=dev` |
| `Zorunlu ortam değişkeni eksik: DISCORD_TOKEN` | `.env` yok veya boş | Adım 3'ü yap |
| `DISCORD GİRİŞİ BAŞARISIZ` + `invalid token` | Token yanlış/kopyalama hatası | Portal → Reset Token. Baştaki/sondaki boşluk ve `Bot ` öneki olmasın |
| `disallowed intents` | Portal'da intent ayarı | Portal → Bot → Privileged Gateway Intents. **Bu bot hiçbirini istemez**, hepsini kapatabilirsin |
| Süreç anında ölüyor, çıktı yok, **exit code 137** | **RAM yetersiz (OOM)** | 128 MB yetmez. En az 256 MB, ideal 512 MB istediğin plana geç |
| `npm install` çok yavaş / timeout | Panel kaynak limiti | `--omit=dev` kullan, gereksiz paketleri kurma |
| Bot çevrimiçi, ama Discord'da komut yok | Global kayıt gecikmesi | `DEV_GUILD_ID` doldur → anında görünür |
| Bot çevrimiçi, `/play` hata veriyor | **Bot çalışıyor**, Lavalink sorunu | `npm run doctor` çalıştır. Muhtemelen public node ölmüş → başka node dene |

> Dikkat: bot Discord'a giriş yapıyorsa sorun "bot" değil "Lavalink"tir. Bu ikisini
> ayırmak teşhisin yarısıdır. `npm run doctor` bu ayrımı yapar.

---

## 3. Public Lavalink node'ları hakkında

`.env.example` varsayılan olarak paylaşımlı bir public node'a bağlanır. Bu **başlamak
için** doğru bir tercih: Discord tarafını doğrular, kurulumu basitleştirir.

Ama bilmen gereken sınırlar:

- **Paylaşımlıdır.** Egress IP'sini yüzlerce bot kullanır → YouTube hızlıca 429 verir.
- **Haber vermeden ölebilir.** Node sahibi kapatırsa botun müzik özelliği durur
  (bot çalışmaya devam eder, `/play` hata verir).
- **Ses, üçüncü bir tarafın sunucusundan geçer.** Gizlilik açısından not et.

Kalıcı çözüm: kendi Lavalink'ini ayrı bir sunucuda çalıştır.
`lavalink/application.yml` + `lavalink/Dockerfile` bunun için hazır.

---

## 4. Sonraki adım: kendi Lavalink'in

Aynı panellerde **ikinci bir sunucu** aç (Java 17/21 egg'i ile) ve `lavalink/`
klasörünü oraya yükle. Sonra ana botun `.env` dosyasını şuna çevir:

```env
LAVALINK_HOST=<lavalink-sunucusunun-ip-veya-hostu>
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
```

Lavalink servisi 512 MB RAM'de `-Xmx384m` ile rahat çalışır.

> Ücretsiz planlarda günlük/haftalık **yenileme (renew)** zorunluluğu vardır.
> Yenilemezsen panel sunucuyu askıya alır — bu da "bot bir gün durdu" şikayetlerinin
> klasik sebebidir. Panelin sana renew hatırlatması göndermesini sağla.
