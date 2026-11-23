import { log } from '../config.js';
import { getAutoLeaveDelay } from '../settings.js';
import { finishNowPlaying } from './nowPlaying.js';
import { forgetGuild } from './player.js';

/**
 * Kanalda kimse kalmayınca otomatik ayrılma.
 *
 * Discord botları ses kanalında "boş beklemek" için para/CPU harcar; Wispbyte
 * gibi 512 MB'lık bir planda bu gereksiz. Kural:
 *
 *   - Botun bulunduğu kanalda **bot olmayan 0 üye** varsa sayaç başlar
 *   - 10 dakika içinde biri girerse sayaç iptal
 *   - Süre dolarsa kart "ayrıldım" durumuna çekilir, oynatıcı yok edilir
 *
 * Olay tabanlı: `voiceStateUpdate` her giriş/çıkışta çalışır, ek poll yok.
 * `attachAutoLeave` ikinci argümanla test için farklı gecikme alabilir.
 */
export const AUTO_LEAVE_DELAY = 10 * 60 * 1000;

const timers = new Map();

function listenerCount(channel) {
  if (!channel?.members) return 0;
  return channel.members.filter((member) => !member.user?.bot).size;
}

function resolveChannel(client, player) {
  if (!player?.voiceChannelId) return null;
  return client.guilds?.cache?.get(player.guildId)?.channels?.cache?.get(player.voiceChannelId) ?? null;
}

function clearTimer(guildId) {
  const timer = timers.get(guildId);
  if (!timer) return false;
  clearTimeout(timer);
  timers.delete(guildId);
  return true;
}

/**
 * Kanalın doluluk durumuna göre sayacı başlatır/iptal eder.
 * Dışarıdan da çağrılabilir (ör. parça başlarken ilk kontrol).
 */
export function refreshAutoLeave(client, player, { delay } = {}) {
  const guildId = player?.guildId;
  if (!guildId || !player?.voiceChannelId) return;

  // Süre sunucu bazlı ayardan gelir (`/settings ayrilma`); 0 = özellik kapalı.
  const wait = Number.isFinite(delay) ? delay : getAutoLeaveDelay(guildId);
  if (!wait) {
    clearTimer(guildId);
    return;
  }

  const channel = resolveChannel(client, player);
  const listeners = listenerCount(channel);

  if (listeners > 0) {
    if (clearTimer(guildId)) {
      log.debug(`Kanalda dinleyici var, otomatik ayrılma iptal (${guildId}).`);
    }
    return;
  }

  if (timers.has(guildId)) return;

  log.info(
    `Ses kanalı boş (${guildId}); ${wait >= 60000 ? `${Math.round(wait / 60000)} dk` : `${Math.round(wait / 1000)} sn`} sonra ayrılacağım.`,
  );

  const timer = setTimeout(async () => {
    timers.delete(guildId);

    const fresh = client.lavalink?.getPlayer(guildId);
    if (!fresh?.voiceChannelId) return;

    // Bu arada biri girmiş olabilir: son kez bak.
    if (listenerCount(resolveChannel(client, fresh)) > 0) return;

    log.info(`Kanal boş kaldı, ses kanalından ayrılıyorum (${guildId}).`);
    try {
      await finishNowPlaying(
        client,
        guildId,
        fresh,
        '👋  **Kanal boş kaldı**, ayrıldım. Yeni şarkı için `/play`.',
      );
      await fresh.destroy();
      forgetGuild(guildId);
    } catch (error) {
      log.warn('Otomatik ayrılma başarısız:', error?.message ?? error);
    }
  }, wait);

  timer.unref?.();
  timers.set(guildId, timer);
}

/** Ses durumu değiştikçe sayaçları güncelleyen dinleyiciyi bağlar. */
export function attachAutoLeave(client, { delay } = {}) {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    const player = client.lavalink?.getPlayer(guildId);
    if (!player?.voiceChannelId) return;

    // Sadece botun kanalına dokunan değişikliklerle ilgileniyoruz.
    const relevant =
      oldState.channelId === player.voiceChannelId || newState.channelId === player.voiceChannelId;
    if (!relevant) return;

    refreshAutoLeave(client, player, { delay });
  });
}

/** Oynatıcı yok edilirken bekleyen sayacı temizler. */
export function cancelAutoLeave(guildId) {
  clearTimer(guildId);
}
