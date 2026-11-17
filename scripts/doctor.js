/**
 * Teşhis aracı — "bot tepki vermiyor" sorununu yerinde çözer.
 *
 * Ağ erişimi gerektirir ama Discord'a giriş yapmaz. Sırayla kontrol eder:
 *   1. Node sürümü ve bellek
 *   2. Ortam değişkenleri
 *   3. Discord token biçimi
 *   4. Lavalink düğümüne TCP erişimi
 *   5. Lavalink REST + sürüm bilgisi
 *   6. Lavalink üzerinden gerçek bir arama (uçtan uca müzik testi)
 *
 * Kullanım:  npm run doctor
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let warnings = 0;

const ok = (msg) => console.log(`  \u001b[32m✓\u001b[0m ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  \u001b[31m✗\u001b[0m ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.log(`  \u001b[33m!\u001b[0m ${msg}`);
};

const section = (title) => console.log(`\n\u001b[1m${title}\u001b[0m`);

// ─── 1. Çalışma ortamı ──────────────────────────────────────────────────────
section('1. Çalışma ortamı');
{
  const major = Number.parseInt(process.version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    ok(`Node.js ${process.version}`);
  } else {
    bad(`Node.js ${process.version} çok eski. En az 18 gerekir (18/20/22 önerilir).`);
  }

  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  ok(`Kullanılan bellek: ${rssMb} MB`);

  if (!existsSync(path.join(projectRoot, 'node_modules', 'discord.js'))) {
    bad('node_modules bulunamadı. Panel konsolunda `npm install` çalıştır.');
  } else {
    ok('Bağımlılıklar kurulu (discord.js mevcut)');
  }

  if (!existsSync(path.join(projectRoot, '.env'))) {
    warn('.env dosyası yok. Panel kullanıyorsan bu normal (değişkenler panelden gelir).');
  } else {
    ok('.env dosyası bulundu');
  }
}

// ─── 2. Yapılandırma ────────────────────────────────────────────────────────
section('2. Yapılandırma');
let config;
try {
  ({ config } = await import('../src/config.js'));
  for (const [key, value] of Object.entries({
    'Node sürümü': process.version,
    'Discord token': config.token ? `${config.token.slice(0, 4)}…(${config.token.length} karakter)` : 'YOK',
    'Client ID': config.clientId,
    'Lavalink': `${config.lavalink.host}:${config.lavalink.port} secure=${config.lavalink.secure}`,
    'Arama kaynağı': config.searchPlatform,
    'Last.fm': config.lastfmKey ? 'var' : 'yok',
  })) {
    console.log(`  ${key.padEnd(16)}: ${value}`);
  }
  ok('Zorunlu değişkenler okundu');
} catch (error) {
  bad(`Yapılandırma okunamadı: ${error.message}`);
  if (error.hint) console.log(`      → ${error.hint}`);
  console.log('\nYapılandırma olmadan devam edilemez. Yukarıdaki eksikleri gider ve tekrar çalıştır.');
  process.exit(1);
}

// ─── 3. Discord token biçimi ────────────────────────────────────────────────
section('3. Discord token biçimi');
{
  const parts = config.token.split('.');
  if (parts.length === 3 && config.token.length > 50) {
    ok('Token biçimi geçerli görünüyor');
  } else {
    bad('Token biçimi hatalı görünüyor. Kopyalarken baştaki/sondaki boşluk veya "Bot " öneki kalmasın.');
  }

  if (!/^\d{15,25}$/.test(config.clientId)) {
    bad(`CLIENT_ID sayısal olmalı: "${config.clientId}"`);
  } else {
    // Token'ın ilk parçası, Application ID'nin base64 kodlanmış halidir
    // (padding'siz). Karşılaştırmak için önce çözmemiz gerekir.
    let decodedId = null;
    try {
      decodedId = Buffer.from(parts[0], 'base64').toString('utf8');
    } catch {
      decodedId = null;
    }

    if (decodedId === config.clientId) {
      ok('CLIENT_ID token ile tutarlı (aynı uygulama)');
    } else if (decodedId && /^\d+$/.test(decodedId)) {
      bad(
        `CLIENT_ID, token'ın ait olduğu uygulamayla eşleşmiyor.\n` +
          `      Token'ın uygulama ID'si: ${decodedId}\n` +
          `      .env'deki CLIENT_ID       : ${config.clientId}\n` +
          `      → İkisi aynı uygulamadan olmalı, yoksa slash komutlar kaydolmaz.`,
      );
    } else {
      warn('Token biçimi beklenenden farklı; ilk parça çözümlenemedi.');
    }
  }
}

// ─── 4. Discord'a erişim ────────────────────────────────────────────────────
section('4. Discord API ve Gateway');
{
  // 4a. Kimlik doğrulamasız: API erişilebilir mi?
  try {
    const res = await fetch('https://discord.com/api/v10/gateway', {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      ok(`Discord REST API erişilebilir (HTTP ${res.status})`);
    } else {
      bad(`Discord REST API beklenmedik yanıt: HTTP ${res.status}`);
    }
  } catch (error) {
    bad(`Discord REST API'ye ulaşılamadı: ${error.message}`);
    console.log('      → Bazı ülkelerde (TR, RU, IR, CN) Discord engellidir.');
    console.log('      → Botu VPN olmadan çalıştıramazsın.');
  }

  // 4b. Kimlik doğrulamalı: token gerçekten çalışıyor mu?
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${config.token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const me = await res.json();
      ok(`Token geçerli — bot: ${me.username} (id ${me.id})`);
    } else if (res.status === 401) {
      bad('Token reddedildi (HTTP 401). Token yanlış veya resetlenmiş.');
    } else {
      bad(`Token kontrolü beklenmedik yanıt: HTTP ${res.status}`);
    }
  } catch (error) {
    bad(`Token kontrolü başarısız: ${error.message}`);
  }

  // 4c. Asıl login yolu: Gateway WebSocket
  try {
    const { default: WebSocket } = await import('ws');
    await new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('15 saniye içinde yanıt gelmedi'));
      }, 15000);

      ws.once('message', (raw) => {
        clearTimeout(timer);
        let opcode = null;
        try {
          opcode = JSON.parse(raw.toString()).op;
        } catch {
          /* yoksay */
        }
        ws.close();
        if (opcode === 10) {
          ok('Gateway WebSocket bağlantısı kuruldu (HELLO alındı)');
        } else {
          warn(`Gateway'den beklenmedik mesaj (op=${opcode})`);
        }
        resolve();
      });

      ws.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  } catch (error) {
    bad(`Gateway WebSocket başarısız: ${error.message}`);
    console.log('      → Bu, botun Discord\'a girememesinin doğrudan sebebidir.');
    console.log('      → ISS seviyesinde DPI/engelleme olabilir. Test: tarayıcıda');
    console.log('        https://discord.com/api/v10/gateway açılıyorsa ama burası');
    console.log('        başarısızsa, WebSocket katmanı engelleniyor demektir.');
    console.log('      → Çözüm: tüm trafiği tünelleten bir VPN (split-tunnel DEĞİL).');
  }
}

// ─── 5. Lavalink TCP erişimi ────────────────────────────────────────────────
section('5. Lavalink düğümüne erişim');
const { host, port, secure, password } = config.lavalink;

const tcpReachable = await new Promise((resolve) => {
  const socket = net.createConnection({ host, port });
  const done = (result) => {
    socket.destroy();
    resolve(result);
  };
  socket.setTimeout(8000);
  socket.once('connect', () => done(true));
  socket.once('timeout', () => done(false));
  socket.once('error', () => done(false));
});

if (tcpReachable) {
  ok(`TCP bağlantısı kuruldu: ${host}:${port}`);
} else {
  bad(`TCP bağlantısı kurulamadı: ${host}:${port}`);
  console.log('      → Panel kullanıyorsan giden bağlantı engelli olabilir.');
  console.log('      → Host/port doğru mu? Public node listesi: https://lavalink.darrennathanael.com');
}

// ─── 5. Lavalink REST ───────────────────────────────────────────────────────
section('6. Lavalink REST API');
const scheme = secure ? 'https' : 'http';
const baseUrl = `${scheme}://${host}:${port}`;

async function lavalinkGet(pathname, timeoutMs = 12000) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { Authorization: password },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

if (tcpReachable) {
  try {
    const res = await lavalinkGet('/version');
    if (res.ok) {
      const version = (await res.text()).trim();
      ok(`Lavalink sürümü: ${version || '(boş yanıt)'}`);
    } else if (res.status === 401 || res.status === 403) {
      bad(`Kimlik doğrulama başarısız (HTTP ${res.status}). LAVALINK_PASSWORD yanlış.`);
    } else {
      bad(`/version beklenmedik yanıt: HTTP ${res.status}`);
    }
  } catch (error) {
    bad(`/version isteği başarısız: ${error.message}`);
    console.log('      → secure=true iken sunucu HTTP ise (veya tersi) bu hata gelir.');
    console.log(`      → Şu an denenen: ${baseUrl} (LAVALINK_SECURE=${secure})`);
  }

  // ─── 7. Uçtan uca müzik testi ─────────────────────────────────────────────
  section('7. Uçtan uca arama testi');
  try {
    const res = await lavalinkGet('/v4/loadtracks?identifier=' + encodeURIComponent(`${config.searchPlatform}:test`));
    if (!res.ok) {
      bad(`Arama isteği HTTP ${res.status} döndü`);
    } else {
      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : data?.data ? 1 : 0;

      if (data?.loadType === 'search' || data?.loadType === 'track') {
        const first = Array.isArray(data.data) ? data.data[0] : data.data;
        ok(`Müzik araması çalışıyor: "${first?.info?.title ?? '?'}" (${data.loadType})`);
      } else if (data?.loadType === 'empty') {
        bad('Arama sonuç döndürmedi (loadType: empty). Düğümde YouTube kaynağı bozuk olabilir.');
      } else {
        bad(`Beklenmeyen yanıt: loadType=${data?.loadType}, ${count} parça`);
      }
    }
  } catch (error) {
    bad(`Arama testi başarısız: ${error.message}`);
  }
} else {
  console.log('  \u001b[2m(6 ve 7 atlandı: TCP bağlantısı yok)\u001b[0m');
}

// ─── Sonuç ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
if (failures === 0) {
  console.log(`\u001b[32m✓ Teşhis tamam: kritik sorun yok.\u001b[0m ${warnings} uyarı.`);
  console.log('\nSıradaki adım: npm start   (veya panelde Start)');
} else {
  console.log(`\u001b[31m✗ ${failures} kritik sorun bulundu.\u001b[0m ${warnings} uyarı.`);
  console.log('\nYukarıdaki ✗ satırlarını sırayla gider. Sorun devam ederse bu çıktının tamamını paylaş.');
  process.exit(1);
}
