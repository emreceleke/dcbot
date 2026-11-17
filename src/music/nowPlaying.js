import { log } from '../config.js';
import { buildControlRows, nowPlayingPayload, textCard } from './card.js';
import { COLORS } from './embeds.js';

/**
 * Sunucu başına "şimdi çalıyor" mesajının referansı.
 * Amaç: parça değiştiğinde aynı kartı güncellemek, kuyruğa mesaj yığmamak.
 */
const nowPlayingMessages = new Map();
let updater = null;

export function rememberNowPlaying(guildId, channelId, messageId) {
  nowPlayingMessages.set(guildId, { channelId, messageId });
}

export function forgetNowPlaying(guildId) {
  nowPlayingMessages.delete(guildId);
}

async function fetchMessage(client, reference) {
  const channel = await client.channels.fetch(reference.channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;
  return channel.messages.fetch(reference.messageId).catch(() => null);
}

/** Kayıtlı kartı yeni parça/durum ile günceller. */
export async function refreshNowPlaying(client, guildId, player, track) {
  const reference = nowPlayingMessages.get(guildId);
  if (!reference) return;

  try {
    const message = await fetchMessage(client, reference);
    if (!message) {
      forgetNowPlaying(guildId);
      return;
    }

    await message.edit(nowPlayingPayload(player, track));
  } catch (error) {
    log.debug('Şimdi çalıyor kartı güncellenemedi:', error?.message ?? error);
    forgetNowPlaying(guildId);
  }
}

/**
 * İlerleme çubuğunu canlı tutar.
 * Duraklatılmışken gereksiz düzenleme yapmaz.
 */
export function startNowPlayingUpdater(client, intervalMs = 15_000) {
  if (updater) clearInterval(updater);

  updater = setInterval(() => {
    for (const guildId of nowPlayingMessages.keys()) {
      const player = client.lavalink?.getPlayer(guildId);
      if (!player?.queue?.current || player.paused) continue;
      refreshNowPlaying(client, guildId, player, player.queue.current).catch(() => {});
    }
  }, intervalMs);

  updater.unref?.();
  return updater;
}

/** Duraklat/devam durumunu buton üzerinden kartta yansıtır. */
export async function refreshPauseState(interaction, player) {
  await interaction.update(nowPlayingPayload(player, player.queue.current));
}

/** Kartı "bitti" / "durduruldu" durumuna getirir. */
export async function finishNowPlaying(
  client,
  guildId,
  player,
  content = '⏹️  **Kuyruk bitti.** Yeni şarkı için `/play` kullan.',
) {
  const reference = nowPlayingMessages.get(guildId);
  if (!reference) return;

  try {
    const message = await fetchMessage(client, reference);
    if (!message) return;

    await message.edit(
      textCard(content, {
        // Kart artık "bitti": kontrol butonları pasif görünsün.
        rows: buildControlRows({
          paused: false,
          repeatMode: 'off',
          queue: { current: null, previous: [], tracks: [] },
        }),
        accent: COLORS.warning,
      }),
    );
  } catch (error) {
    log.debug('Bitiş kartı güncellenemedi:', error?.message ?? error);
  }
}
