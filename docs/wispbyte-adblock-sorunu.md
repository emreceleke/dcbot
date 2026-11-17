# Wispbyte "reklam engelleyici algılandı" — kök neden ve çözüm

**Özet:** Kullanıcının bilgisayarında reklam engelleyici YOK. Sorun, Türkiye'deki
ISP'nin reklam domainini **DNS seviyesinde kaçırıp (DNS hijacking) Yandex'e
yönlendirmesi.** Wispbyte reklam scriptini yüklenmemiş görünce "adblock var"
sanıyor ve sert blok uyguluyor.

---

## 1. Tespit mekanizması (Wispbyte'ın kodu okunarak çıkarıldı)

Reklam onay sistemi `wisp-cmp-bridge.js` şu scripti enjekte ediyor:

```
https://hb.vntsm.com/v4/live/vms/sites/wispbyte.com/index.js
```

`onload` → `"loaded"`, `onerror` → `"error"`. Ardından `window.__VM.loaded`
kontrol ediliyor:

```js
function Ge(){ return ne(function(){ return t.__VM && t.__VM.loaded }, 200, Ie)
  .then(..., function(){ return Oe() ? "unknown" : "hard" }) }   // → "hard" = blok
```

Yani: **reklam scripti yüklenmezse kullanıcı suçlanır**, gerçek sebep sorulmaz.
Blok durumu `localStorage.last_block_type = "hard"` ve
`sessionStorage.wisp_view_walled = "1"` olarak işaretlenir.

---

## 2. Kanıt

### Yetkili DNS vs kullanıcının ağı

| Kaynak | `hb.vntsm.com` cevabı |
|---|---|
| Cloudflare DoH | `18.172.242.x` — AWS CloudFront ✅ |
| Google DoH | `65.9.9.x` — AWS CloudFront ✅ |
| Kullanıcının router'ı (192.168.0.1) | `77.88.55.88` — **Yandex** ❌ |
| Kullanıcı 8.8.8.8'e sorunca | `5.255.255.77` — **Yandex** ❌ |

Sertifika: `CN=*.yandex.ru, O=YANDEX LLC, L=Moscow, C=RU`

> 8.8.8.8'e yapılan sorgunun da Yandex dönmesi, ISP'nin **DNS trafiğini araya
> girip ele geçirdiğini** (transparent DNS interception) kanıtlıyor. Yani
> router'ın DNS'ini değiştirmek **işe yaramaz.**

### Script gerçekten sağlam mı?

```
ISP DNS ile            → HTTP 000  (yüklenmiyor)
18.172.242.49 zorla    → HTTP 200, 58.752 byte geçerli JS
65.9.9.62 zorla        → HTTP 200, 58.752 byte
18.172.242.5 zorla     → HTTP 200, 58.752 byte
```

Script sağlam. Tek engel DNS kaçırması.

### Elenen sebepler

| Şüpheli | Durum |
|---|---|
| Reklam engelleyici eklenti | Yok ✅ |
| hosts dosyası | 10.656 satır, **hepsi Adobe telemetrisi** — reklam ağı yok ✅ |
| DNS filtresi (genel) | Router ve 8.8.8.8 normal domainlerde aynı cevabı veriyor ✅ |
| Google reklam kütüphanesi (`gpt.js`) | Yükleniyor (200, 139 KB) ✅ |
| CMP köprüsü (`wisp-cmp-bridge.js`) | Yükleniyor (200, 169 ms) ✅ |

---

## 3. Çözüm: DNS over HTTPS (DoH)

Kaçırma **DNS katmanında** olduğu için, DNS'i şifreli kanaldan (HTTPS) çözmek
sorunu atlar. Tarayıcı ayarı, 30 saniye:

### Chrome
`Ayarlar → Gizlilik ve güvenlik → Güvenlik → Gelişmiş`
→ **"Güvenli DNS kullan"** açık
→ **"Özel"** seç
→ `https://dns.google/dns-query`

### Edge
`Ayarlar → Gizlilik, arama ve hizmetler → Güvenlik`
→ **"Ağ adreslerinin nasıl aranacağını belirtmek için güvenli DNS kullan"** açık
→ **Google** veya **Cloudflare** seç

### Firefox
`Ayarlar → Gizlilik ve Güvenlik → HTTPS üzerinden DNS`
→ **Maksimum Koruma**
→ Sağlayıcı: `Cloudflare` veya `https://dns.google/dns-query`

### Doğrulama
Ayarları yaptıktan sonra <https://1.1.1.1/help> adresini aç.
"Using DNS over HTTPS (DoH)" → **Yes** görmelisin.

Sonra Wispbyte'a gir, **"Tekrar kontrol et"** düğmesine bas.

> **Not:** DoH sadece tarayıcıyı kapsar. Bot sunucunun VPN'i zaten gerekmiyor —
> bot Almanya/ABD'deki sunucuda çalışacak, orada böyle bir engel yok.

---

## 4. DoH işe yaramazsa

1. **Router'ın DNS'i** değiştirmek **çözmez** (ISP DNS'i ele geçiriyor).
   Yine de denemek istersen: modem arayüzü → DNS → `1.1.1.1` / `8.8.8.8`
2. **Tam tünel VPN** kesin çözer (tarayıcı eklentisi değil, sistem VPN'i)
3. **Wispbyte desteğine yaz** — aşağıdaki mesaj hazır
4. **Başka host'a geç** — bu sorun Wispbyte'ın reklam ağına özel. FadeHost/Nylix
   gibi reklam şartı olmayan ücretsiz sağlayıcılarda bu duvar hiç yok.

### Destek mesajı

```
Subject: False positive "ad blocker detected" — /client redirects to
         /client/disable-adblocker

Hi,

I cannot reach my panel: /client always redirects me to
/client/disable-adblocker with last_block_type = "hard".

I have verified there is no ad blocker on my side:
- No ad-blocking extension, no VPN, no antivirus filter
- hosts file contains only Adobe telemetry entries
- Google GPT (securepubads.g.doubleclick.net/tag/js/gpt.js) loads fine

I found the actual cause. Your CMP bridge injects
https://hb.vntsm.com/v4/live/vms/sites/wispbyte.com/index.js

From my network, hb.vntsm.com resolves to Yandex IPs (77.88.55.88 /
5.255.255.77, certificate CN=*.yandex.ru) instead of AWS CloudFront
(18.172.242.x). My ISP hijacks the DNS response for that domain.

Forcing the real CloudFront IP makes your ad script load correctly:
  HTTP 200, 58752 bytes of valid JavaScript.

So the ad script is fine; my ISP's DNS interception breaks it, and your
detector reports "hard block" because __VM.loaded never becomes true.

Could you please whitelist my account, or make the detector treat a
failed ad-script request as "unknown" rather than "hard"?

Account email: <BURAYA_EMAILINI_YAZ>
```

**Argümanın gücü:** destek ekibine "reklam engelleyicim yok" demek yerine
**nedenini ve kanıtını** veriyorsun. Bu genelde "soft"/whitelist geçişiyle sonuçlanır.
