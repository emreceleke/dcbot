import { EmbedBuilder } from 'discord.js';
import { log } from '../config.js';
import { buildControlRows } from './controls.js';
import { COLORS, infoEmbed, nowPlayingCard } from './embeds.js';
import { isAutoplayEnabled } from './settings.js';

/**
 * Sunucu başına "şimdi çalıyor" mesajının referansı.
 * Amaç: parça değiştiğinde aynı mesajı güncellemek, kuyruğa embed yığmamak.
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

    await message.edit({
      embeds: [nowPlayingCard(player, track, { autoplay: isAutoplayEnabled(guildId) })],
      components: buildControlRows(player),
    });
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

/** Duraklat/devam durumunu buton üzerinden yansıtır. */
export async function refreshPauseState(interaction, player) {
  const existing = interaction.message.embeds[0];
  const card = existing
    ? EmbedBuilder.from(existing)
    : nowPlayingCard(player, player.queue.current, {
        autoplay: isAutoplayEnabled(interaction.guildId),
      });

  card.setColor(player.paused ? COLORS.warning : COLORS.primary);
  card.setFooter({ text: player.paused ? 'Duraklatıldı' : 'Çalıyor' });

  await interaction.update({ embeds: [card], components: buildControlRows(player) });
}

/** Kuyruk tükendiğinde kartı "bitti" durumuna getirir. */
export async function finishNowPlaying(client, guildId, player) {
  const reference = nowPlayingMessages.get(guildId);
  if (!reference) return;

  try {
    const message = await fetchMessage(client, reference);
    if (!message) return;

    await message.edit({
      embeds: [infoEmbed('⏹️ Kuyruk bitti. Yeni şarkı için `/play` kullan.')],
      components: buildControlRows(player),
    });
  } catch (error) {
    log.debug('Bitiş kartı güncellenemedi:', error?.message ?? error);
  }
}

/** Butonlar hemen yansısın diye kayıtlı kartı yeniler (parça değişmeden). */
export async function refreshControls(client, guildId, player) {
  await refreshNowPlaying(client, guildId, player, player?.queue?.current ?? null);
}
