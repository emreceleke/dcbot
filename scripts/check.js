/**
 * Uçuş öncesi kontrol (pre-flight).
 *
 * Amacı: botu ayağa kaldırmadan önce yapılandırmanın ve tüm komut dosyalarının
 * yapısal olarak geçerli olduğunu doğrulamak. Ağ/Discord erişimi gerekmez.
 *
 * Çalıştır:  npm run check
 */

// .env olmadan da çalışabilmesi için sahte değerler.
process.env.DISCORD_TOKEN ||= 'check-token';
process.env.CLIENT_ID ||= '000000000000000000';

const { config } = await import('../src/config.js');

const problems = [];

// ─── 1. Yapılandırma özeti ──────────────────────────────────────────────────
const searchPlatform = config.searchPlatform;
const KNOWN_PLATFORMS = ['ytsearch', 'ytmsearch', 'scsearch', 'bcsearch'];
if (!KNOWN_PLATFORMS.includes(searchPlatform)) {
  problems.push(
    `SEARCH_PLATFORM "${searchPlatform}" bilinen bir platform değil. ` +
      `Beklenen: ${KNOWN_PLATFORMS.join(', ')}`,
  );
}

if (config.lavalink.port < 1 || config.lavalink.port > 65535) {
  problems.push(`LAVALINK_PORT geçersiz: ${config.lavalink.port}`);
}

if (config.defaultVolume < 0 || config.defaultVolume > 1000) {
  problems.push(`DEFAULT_VOLUME makul aralık dışında: ${config.defaultVolume}`);
}

// ─── 2. Komut modülleri ─────────────────────────────────────────────────────
const { readdir } = await import('node:fs/promises');
const path = await import('node:path');
const { pathToFileURL, fileURLToPath } = await import('node:url');

const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'commands');
const files = (await readdir(commandsDir)).filter((file) => file.endsWith('.js'));

const names = new Map();

for (const file of files) {
  const module = await import(pathToFileURL(path.join(commandsDir, file)).href);
  const command = module.default;

  if (!command?.data?.name) {
    problems.push(`${file}: 'data' (SlashCommandBuilder) yok.`);
    continue;
  }
  if (typeof command.execute !== 'function') {
    problems.push(`${file}: 'execute' fonksiyonu yok.`);
    continue;
  }

  const json = command.data.toJSON();
  if (!/^[-_\p{L}\p{N}]{1,32}$/u.test(json.name)) {
    problems.push(`${file}: komut adı Discord kurallarına uymuyor: "${json.name}"`);
  }
  for (const option of json.options ?? []) {
    if (option.required && option.description.length < 1) {
      problems.push(`${file}: "${option.name}" seçeneğinin açıklaması yok.`);
    }
  }
  if (names.has(json.name)) {
    problems.push(`Komut adı çakışması: "${json.name}" (${names.get(json.name)} ve ${file})`);
  }
  names.set(json.name, file);
}

// ─── 3. Emoji doğrulaması ───────────────────────────────────────────────────
// Discord buton emoji'lerinde yalnızca gerçek Unicode emoji'lerini kabul eder.
// ☰ gibi semboller 400 "Invalid Form Body" döndürür ve komut sessizce patlar.
{
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const controlsUrl = pathToFileURL(path.join(srcDir, 'music', 'controls.js')).href;
  const { buildControlRows } = await import(controlsUrl);

  const basePlayer = {
    queue: {
      current: { info: {} },
      previous: [{ info: {} }],
      tracks: [{ info: {} }],
    },
    repeatMode: 'off',
  };

  let checked = 0;
  const seen = new Set();

  // Butonları gerçekten kurup JSON'unu doğrula; ternary ile seçilen
  // emoji'ler (▶️ / ⏸️) da böylece yakalanır.
  for (const paused of [false, true]) {
    for (const row of buildControlRows({ ...basePlayer, paused })) {
      for (const component of row.toJSON().components ?? []) {
        const emoji = component.emoji?.name;
        if (!emoji) continue;

        const id = `${component.custom_id}:${emoji}`;
        if (seen.has(id)) continue;
        seen.add(id);
        checked += 1;

        if (!/\p{Emoji}/u.test(emoji)) {
          problems.push(
            `controls.js: "${emoji}" (${component.custom_id}) geçerli bir Discord emojisi değil. ` +
              `Buton 400 döndürür — gerçek bir Unicode emoji kullan.`,
          );
        }
      }
    }
  }

  console.log(`Emoji kontrolü : ${checked} buton emojisi doğrulandı`);
}

// ─── 4. Sonuç ───────────────────────────────────────────────────────────────
console.log('\nYapılandırma');
console.log(`  Lavalink     : ${config.lavalink.host}:${config.lavalink.port} (secure=${config.lavalink.secure})`);
console.log(`  Arama kaynağı: ${searchPlatform}`);
console.log(`  Autoplay     : ${config.autoplay ? 'açık' : 'kapalı'}`);
console.log(`  Öneri motoru : ${config.lastfmKey ? 'Last.fm + YouTube mix' : 'yalnızca YouTube mix'}`);
console.log(`  Playlist sın.: ${config.maxPlaylistSize} parça`);
console.log(`\nKomutlar (${names.size})`);
for (const [name, file] of [...names].sort()) {
  console.log(`  /${name.padEnd(14)} ${file}`);
}

if (problems.length) {
  console.error(`\n${problems.length} sorun bulundu:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log('\n✓ Kontrol başarılı.');
