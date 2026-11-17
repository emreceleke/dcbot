# Discord kurulumu — token, Client ID, izinler

Bu rehber Discord Developer Portal'dan **token** ve **Client ID** almayı, hangi
**izinleri** açacağını ve botu sunucuya nasıl davet edeceğini anlatır.

---

## 0. Önce karışıklığı giderelim: iki farklı "izin" var

Developer Portal'da iki ayrı yerde izin ayarı var ve bunlar **tamamen farklı şeyler**:

| | Nerede | Ne işe yarar | Bu bot ne ister |
|---|---|---|---|
| **A) Privileged Gateway Intents** | `Bot` sekmesi | Botun Discord'dan hangi **olay verilerini** alabileceği (kim üye oldu, kim mesaj yazdı…) | **HİÇBİRİ** — üçünü de kapalı bırak |
| **B) Bot Permissions** | Davet linki üretirken | Botun sunucuda **ne yapmaya izinli** olduğu (mesaj gönder, sese katıl…) | 5 tanesi (aşağıda) |

`A`'yı yanlış anlamak en sık hatadır: bot "tepki vermiyor" sanılır, oysa intent'in
konuyla ilgisi yoktur. Bu bot yalnızca `Guilds` ve `GuildVoiceStates` kullanır;
**ikisi de privileged değil**, yani hiçbir toggle açman gerekmez.

---

## 1. Uygulamayı oluştur

1. <https://discord.com/developers/applications> adresine git
2. Discord hesabınla giriş yap
3. Sağ üstte **New Application**
4. Bir isim ver (ör. `MuzikBot`) → kutucuğu işaretle → **Create**

---

## 2. Client ID'yi al

Sol menüden **General Information** sekmesine gir.

```
┌─ General Information ──────────────────────────────┐
│  NAME          MuzikBot                            │
│  APPLICATION ID    1234567890123456789   [Copy]    │  ← CLIENT_ID
│  PUBLIC KEY       a1b2c3...              [Copy]    │  (buna gerek yok)
└────────────────────────────────────────────────────┘
```

**Application ID = Client ID.** Aynı şey, sadece farklı isimlendirilmiş.
**Copy** düğmesine bas ve bir yere kaydet.

> `PUBLIC KEY` alanına ihtiyacın yok. Onu `CLIENT_ID` yerine yapıştırmak klasik bir
> hata — o base64 bir anahtar, sayı değil.

`.env` dosyanda:
```env
CLIENT_ID=1234567890123456789
```

---

## 3. Token'ı al

Sol menüden **Bot** sekmesine gir.

1. **Reset Token** düğmesine bas
2. Onay penceresi çıkar (2FA açıksa şifre/kod ister) → onayla
3. Token ekranda bir kez görünür → **Copy** yap ve hemen kaydet

```
┌─ Bot ──────────────────────────────────────────────┐
│  TOKEN                                             │
│  MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.Gxxxxx.yyyyy...  [Copy]│  ← DISCORD_TOKEN
│  [Reset Token]   ← eski token'ı geçersiz kılar     │
└────────────────────────────────────────────────────┘
```

`.env` dosyanda:
```env
DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.Gxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyy
```

> ⚠️ **Token = botun şifresi.** Paylaşırsan biri botunu ele geçirir.
> Ekran görüntüsü alma, git'e commit etme, sohbete yapıştırma.
> Sızarsa: **Reset Token** → yeni token'ı `.env`'e yaz → paneli yeniden başlat.
>
> Token'ı sonradan Reset edersen eski token anında ölür ve paneldeki `.env`'i
> güncellemezsen bot bir daha bağlanamaz. "Dün çalışıyordu, bugün çalışmıyor"
> vakalarının bir numaralı sebebi budur.

---

## 4. Privileged Gateway Intents — HİÇBİRİNİ AÇMA

Aynı **Bot** sekmesinde aşağı kaydır:

```
┌─ Privileged Gateway Intents ───────────────────────┐
│  Presence Intent                [ ] KAPALI         │
│  Server Members Intent          [ ] KAPALI         │
│  Message Content Intent         [ ] KAPALI         │
└────────────────────────────────────────────────────┘
                    ↑ üçü de böyle kalmalı
```

**Bu bot slash komutlarıyla çalışır** — mesajları okumaya ihtiyacı yok. Bunları
açman botun Discord tarafından ek doğrulamaya (100+ sunucuda) tabi tutulmasına
yol açar. Açık bırakmanın hiçbir faydası yok.

---

## 5. Botu sunucuya davet et (izinler burada)

Botu davet ederken hem `applications.commands` iznini hem de **bot izinlerini**
verirsin.

### 5a. UI ile (klasik yol)

1. Sol menüden **OAuth2** → **URL Generator**
2. **SCOPES** kutusunda şunları işaretle:
   - ✅ `bot`
   - ✅ `applications.commands`  ← **bunu unutma, yoksa slash komutlar hiç görünmez**
3. **BOT PERMISSIONS** kutusunda aşağıdaki 5 tanesini işaretle
4. En altta oluşan URL'yi **Copy** et

### 5b. UI ile (yeni yol)

Portal'ın yeni sürümünde **Installation** sekmesi var:
- **Install Link** → `Discord Provided Link` seç
- **Default Install Settings** → `Guild Install` → **Scopes** ve **Permissions**
  bölümlerine 5a'daki seçimleri yap

### 5c. Hazır URL (en kısa yol)

Aşağıdaki URL'de sadece `CLIENT_ID` yerine kendi ID'ni yaz ve tarayıcıda aç:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=3165184
```

Örnek (ID `1234567890123456789` için):
```
https://discord.com/oauth2/authorize?client_id=1234567890123456789&scope=bot+applications.commands&permissions=3165184
```

Açılan sayfada **sunucuyu seç** → **Yetkilendir**.

---

## 6. Gereken izinler (tam liste)

| İzin | İngilizce adı | Değer | Neden gerekli |
|---|---|---|---|
| Kanalları Gör | View Channels | `1024` | Ses/metin kanalını görebilmek |
| Mesaj Gönder | Send Messages | `2048` | Komut yanıtları |
| Bağlantı Yerleştir | Embed Links | `16384` | Şarkı kartları (embed) |
| Bağlan | Connect | `1048576` | Ses kanalına girmek |
| Konuş | Speak | `2097152` | Ses yayını yapmak |
| | | **toplam `3165184`** | |

**Administrator vermeye gerek yok, verme.** Bu bot 5 izinle tam çalışır.
(Farklı bir izin seti istersen değerler toplanır; yukarıdaki `permissions=`
parametresini değiştirmen yeterli.)

`applications.commands` bir bot izni değil, bir **OAuth2 scope**'udur — bu yüzden
5. adımda scopes kutusunda işaretlenir. Yoksa komutlar sunucuda hiç görünmez.

---

## 7. DEV_GUILD_ID nasıl alınır

`.env`'e yazacağın `DEV_GUILD_ID`, komutların **anında** görünmesini sağlar
(yoksa global kayıt 1 saate kadar sürebilir).

1. Discord'da **Kullanıcı Ayarları** → **Gelişmiş** → **Geliştirici Modu**'nu aç
2. Sunucu simgesine **sağ tık** → **Sunucu Kimliğini Kopyala**

```env
DEV_GUILD_ID=987654321098765432
```

> Botu davet etmeden önce bu ID'yi almaya çalışırsan sorun olmaz — ID sunucuya ait,
> bota ait değil. Ama davet işlemini **sunucuya yönetici yetkin olan** bir hesapla
> yapmalısın.

---

## 8. Kontrol listesi

`.env` dosyan böyle görünmeli:

```env
DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.Gxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyy
CLIENT_ID=1234567890123456789
DEV_GUILD_ID=987654321098765432
```

Kontrol:
```sh
npm run doctor
```
`3. Discord token biçimi` bölümünde iki ✓ görmelisin:
```
  ✓ Token biçimi geçerli görünüyor
  ✓ CLIENT_ID token ile tutarlı
```
İkincisi ✗ ise: `CLIENT_ID` ile token **aynı uygulamaya** ait değil demektir.

---

## 9. Sık yapılan hatalar

| Hata | Belirti | Çözüm |
|---|---|---|
| Token'ı `CLIENT_ID`'ye yapıştırmak | `CLIENT_ID sayısal olmalı` | Application ID'yi kopyala (sadece rakam) |
| `PUBLIC KEY`'i Client ID sanmak | Aynı hata | General Information → `APPLICATION ID` |
| `applications.commands` scope'unu seçmemek | Bot çevrimiçi ama **hiç komut yok** | Davet URL'sini düzelt, botu yeniden davet et (atmak gerekmez, tekrar davet günceller) |
| Token'da baştaki/sondaki boşluk | `invalid token` | `.env`'de tırnak kullanma, boşluk bırakma |
| `Bot ` önekini kopyalamak | `invalid token` | Sadece token'ın kendisi |
| Token'ı resetleyip `.env`'i güncellememek | Bir anda `invalid token` | Yeni token'ı `.env`'e yaz, paneli yeniden başlat |
| `DEV_GUILD_ID` boş bırakmak | Komutlar 1 saat görünmüyor | Sunucu ID'sini yaz |
| Administrator vermek | Güvenlik riski | Gerek yok, 5 izin yeterli |
| Privileged intent'leri açmak | Gereksiz doğrulama yükü | Üçünü de kapalı tut |

---

## 10. Botu değiştirdikten sonra

| Ne değişti | Ne yapmalısın |
|---|---|
| Token resetlendi | `.env`'i güncelle → botu yeniden başlat |
| İzinler (permissions) değişti | Davet URL'sini yeniden aç, sunucuya tekrar yetkilendir |
| Yeni slash komut eklendi | Botu yeniden başlat (kendisi kaydeder) |
| Sadece isim/avatar değişti | Hiçbir şey |
| Privileged intent'ler değişti | Hiçbir şey (bu bot kullanmıyor) |
