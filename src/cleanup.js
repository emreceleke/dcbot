import { PermissionsBitField } from 'discord.js';
import { log } from './config.js';
import { listNowPlaying } from './music/nowPlaying.js';

/**
 * Eski bot mesajlarını temizler.
 *
 * Kural: botun **kendi** mesajı 12 saatten eskiyse silinir. Tek istisna, o an
 * bir parça çalıyorsa "şimdi çalıyor" kartıdır — o mesaj oynatıcı olarak
 * güncellenmeye devam ettiği için korunur.
 *
 * Neden ayrı ayrı `delete()`: `bulkDelete` yalnızca 14 günden yeni mesajlarda
 * çalışır. Yaşı 14 günü geçmiş mesajlar da temizlenebilsin diye tek tek
 * siliyoruz (discord.js hız sınırlarını kendi yönetiyor).
 *
 * Neden 30 dakikada bir: Wispbyte gibi 512 MB'lık bir planda sürekli tarama
 * gereksiz; günde 48 tur fazlasıyla yeterli ve API kotasını yakmaz.
 */
export const MESSAGE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 saat
export const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 dakika
const FIRST_DELAY = 15_000; // açılışta cache otursun
const FETCH_LIMIT = 100;
const MAX_PAGES = 3; // kanal başına en fazla 300 mesaj taranır

let running = false;

function isCleanableChannel(channel) {
  return (
    typeof channel?.messages?.fetch === 'function' &&
    channel.isTextBased?.() === true &&
    channel.isDMBased?.() !== true
  );
}

/** O an çalan parçanın kartı: silinmemesi gereken mesaj ID'leri. */
function protectedMessageIds(client) {
  const ids = new Set();

  for (const reference of listNowPlaying()) {
    const player = client.lavalink?.getPlayer(reference.guildId);
    if (player?.queue?.current) ids.add(reference.messageId);
  }

  return ids;
}

async function cleanChannel(channel, botId, cutoff, keep, stats) {
  let before;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const fetched = await channel.messages
      .fetch({ limit: FETCH_LIMIT, ...(before ? { before } : {}) })
      .catch(() => null);

    if (!fetched?.size) break;
    before = fetched.last()?.id;
    if (!before) break;

    for (const message of fetched.values()) {
      if (message.author?.id !== botId) continue;
      if (message.createdTimestamp > cutoff) continue;

      // Sabitlenmiş mesajlar (kurallar, duyurular) bilinçli olarak korunur.
      if (message.pinned || keep.has(message.id) || message.deletable === false) {
        stats.kept += 1;
        continue;
      }

      try {
        await message.delete();
        stats.deleted += 1;
      } catch {
        stats.failed += 1;
      }
    }

    // Son sayfa eksikse daha eski mesaj yok.
    if (fetched.size < FETCH_LIMIT) break;
  }
}

/**
 * Tüm sunucularda bir tur temizlik yapar.
 * Aynı anda iki tarama çalışmaz; süren varsa `null` döner.
 */
export async function sweepMessages(client, { age = MESSAGE_MAX_AGE } = {}) {
  if (!client?.user || running) return null;
  running = true;

  const startedAt = Date.now();
  const cutoff = startedAt - age;
  const keep = protectedMessageIds(client);
  const stats = { deleted: 0, kept: 0, failed: 0, channels: 0, guilds: 0 };

  try {
    for (const guild of client.guilds.cache.values()) {
      const me = guild.members.me;
      if (!me) continue;
      stats.guilds += 1;

      for (const channel of guild.channels.cache.values()) {
        if (!isCleanableChannel(channel)) continue;

        // Mesaj geçmişini okuyamıyorsak fetch her seferinde 403 verir: boşuna denemeyiz.
        const permissions = channel.permissionsFor?.(me);
        if (!permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)) continue;
        if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) continue;

        stats.channels += 1;
        await cleanChannel(channel, client.user.id, cutoff, keep, stats);
      }
    }
  } finally {
    running = false;
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const detail =
    `${stats.deleted} mesaj silindi, ${stats.kept} korundu` +
    `${stats.failed ? `, ${stats.failed} başarısız` : ''} ` +
    `(${stats.channels} kanal / ${stats.guilds} sunucu, ${seconds} sn)`;

  if (stats.deleted || stats.failed) log.info(`Mesaj temizliği: ${detail}`);
  else log.debug(`Mesaj temizliği: ${detail}`);

  return stats;
}

/** Açılışta bir kez, sonra her 30 dakikada bir temizler. */
export function startMessageCleanup(
  client,
  { interval = CLEANUP_INTERVAL, firstDelay = FIRST_DELAY } = {},
) {
  const initial = setTimeout(() => {
    sweepMessages(client).catch(() => {});
  }, firstDelay);
  initial.unref?.();

  const timer = setInterval(() => {
    sweepMessages(client).catch(() => {});
  }, interval);
  timer.unref?.();

  return { timer, initial, stop: () => clearInterval(timer) };
}
