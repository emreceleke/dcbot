# Northflank'a dağıtım

İki servis kuracağız: **bot** (bu repo) ve **lavalink** (ses motoru).
Northflank'ın ücretsiz Sandbox planı: **2 servis, always-on (uyumaz), ayda $20'ye kadar
kaynak dahil.** Bizim toplam maliyetimiz ~$8-15/ay → limit içinde.

> ⚠️ **Kart uyarısı:** Northflank pricing sayfası "No card needed" dese de, **kendi
> dokümanı** bunu net biçimde çürütüyor:
> *"all users must add a payment method to start creating resources on Northflank,
> regardless of plan selection. This is to verify user identity, and prevent malicious
> usage of the platform."*
> Kart yalnızca kimlik doğrulama için; ücretsiz limit içinde kaldıkça çekim olmaz.
> **Mutlaka billing alert kur.**
>
> Ayrıca doküman şunu da ekliyor: *"Our free tier is… great for… hobby projects…
> However, it should not be used for production applications."* Kişisel bir müzik botu
> için sorun değil; herkese açık, yüzlerce sunucuya hizmet eden bir bota dönüşürse
> ücretli plana geç.

> Alternatif: Lavalink'i kendi makinenizde/Oracle'da çalıştırıp botu Northflank'a koyabilirsiniz.
> O durumda 1. adımı atlayın ve bot servisinde `LAVALINK_HOST`'u kendi sunucunuza çevirin.

---

## 0. Ön koşullar

- GitHub hesabı (Northflank repo'dan derliyor)
- Discord bot token'ı + Application ID
- Bu repo bir GitHub reposunda (private olabilir)

```powershell
git init
git add .
git commit -m "ilk sürüm"
git remote add origin https://github.com/<kullanıcı>/dc-music-bot.git
git push -u origin main
```

`.env` **commit edilmemeli** (`.gitignore` içinde). Sırlar panelden girilecek.

---

## 1. Lavalink servisi

1. Northflank → **Create Service** → **Build from repository**
   - Repo: `dc-music-bot`
   - **Build type:** Dockerfile
   - **Dockerfile path:** `lavalink/Dockerfile`
   - **Build context:** `lavalink`
2. **Resources:**
   - Plan: `nf-compute-20` (0.2 vCPU / 512 MB)
   - `instance count: 1` (ölçekleme yapmayın — Lavalink tek örnek olmalı)
3. **Networking → Public ports:** port `2333`, protocol `TCP` aç.
   - Bu adresi not al: `<servis-adı>--2333.<region>.code.run` gibi bir şey verecek.
     *(Ya da public port açmayıp bot ile aynı private network'te tutabilirsin — daha güvenli.)*
4. **Environment variables:**
   - `_JAVA_OPTIONS=-Xmx384m`  (Dockerfile'da var, yine de garantiye al)
5. **Health check:** path `/version`, port `2333`
6. Deploy → loglarda şunu görmelisin:
   ```
   Started Launcher in XXXms
   Loaded plugin 'youtube-plugin'
   ```
7. **application.yml'i düzenle:** gizli kalması gerekiyorsa `lavalink/application.yml`
   içindeki `password: "youshallnotpass"` değerini uzun rastgele bir şifreyle değiştir
   ve aynı değeri bot servisinin `LAVALINK_PASSWORD` değişkenine yaz.

---

## 2. Bot servisi

1. Northflank → **Create Service** → **Build from repository**
   - Repo: `dc-music-bot`
   - **Build type:** Dockerfile
   - **Dockerfile path:** `Dockerfile`  (repo kökündeki)
2. **Resources:**
   - Plan: `nf-compute-10` (0.1 vCPU / 256 MB)
   - instance count: 1
3. **Networking:** public port **gerekmez** (bot dışarıya bağlanıyor, kimse ona bağlanmıyor).
4. **Environment variables:**

| Değişken | Değer |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `CLIENT_ID` | Application ID |
| `DEV_GUILD_ID` | Test sunucunun ID'si (opsiyonel ama önerilir) |
| `LAVALINK_HOST` | Lavalink servisinin host'u (public ise hostname, private ise iç adres) |
| `LAVALINK_PORT` | `2333` (public kullanıyorsan genelde `443`) |
| `LAVALINK_PASSWORD` | `application.yml`'deki şifre |
| `LAVALINK_SECURE` | public + HTTPS kullanıyorsan `true`, private/TCP ise `false` |
| `SEARCH_PLATFORM` | `ytmsearch` |
| `LASTFM_API_KEY` | (opsiyonel) öneri kalitesini artırır |
| `LOG_LEVEL` | `info` (ilk kurulumda `debug`) |

5. Deploy → loglarda sırasıyla şunları görmelisin:
   ```
   [info]  11 komut yüklendi.
   [info]  Giriş yapıldı: BotAdı#1234
   [info]  Lavalink düğümüne bağlandı: main
   [info]  11 komut <guildId> sunucusuna kaydedildi (anında).
   ```

---

## 3. Doğrulama

1. Discord'da bir ses kanalına gir.
2. `/play never gonna give you up`
3. Bot kanala katılmalı ve çalmaya başlamalı.
4. `/similar` → benzer parçalar kuyruğa eklenmeli.
5. Kuyruk bitince autoplay devam etmeli (log: `Autoplay (lastfm): ... parça eklendi.`).

---

## 4. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Bot "Giriş yapıldı" diyor ama komutlar yok | `DEV_GUILD_ID` doğru mu? Yoksa global kayıt için ~1 saat bekle |
| `Lavalink düğümü koptu` | `LAVALINK_HOST/PORT/PASSWORD/SECURE` dörtlüsünü kontrol et. Public portta HTTPS varsa `SECURE=true` |
| Bot kanala giriyor, ses yok | Lavalink loglarında YouTube hatası var mı. PO token gerekiyorsa `application.yml`'deki bölümü aç |
| `Out of memory` (Lavalink) | `_JAVA_OPTIONS=-Xmx384m` değerini `-Xmx256m` yap veya RAM'i 768 MB'a çıkar |
| Servis uyuyor | Northflank Sandbox'ta uyuma yok. Uyuyorsa plan Sandbox mı, ücretli bir plana mı geçmiş kontrol et |

---

## 5. Alternatif: tek serviste her ikisi

Kaynak ayırmak istemiyorsan Lavalink'i bot konteynerine gömebilirsin (supervisor ile iki
process). Ancak Lavalink'in JVM'i ile Node'un aynı cgroup'da yaşaması bellek baskısı
yaratır; **iki ayrı servis önerilir** — Northflank Sandbox zaten 2 servis veriyor.
