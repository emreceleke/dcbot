import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';

import { COLORS, formatDuration, truncate } from './embeds.js';
import { isAutoplayEnabled } from './settings.js';
import { V2_EPHEMERAL } from './card.js';

/**
 * 🎛️ Kontrol Paneli — şimdi çalıyor kartındaki 🎛️ butonundan açılır.
 *
 * Slash komutlarının buton kısayolları. Discord'da buton "komut yazmaz";
 * aynı işi sunucu tarafında yapar ve paneli `interaction.update()` ile
 * yeniden çizer. Bu yüzden her buton tek bir customId taşır:
 *
 *   music:cmd:loop | shuffle | autoplay | stop
 *   music:cmd:volDown | volUp | queue | liked
 */

export const PANEL_PREFIX = 'music:cmd:';

const LOOP_LABELS = { off: 'Kapalı', queue: 'Kuyruk', track: 'Tek parça' };
const LOOP_CYCLE = { off: 'queue', queue: 'track', track: 'off' };

export function loopLabel(mode) {
  return LOOP_LABELS[mode ?? 'off'] ?? 'Kapalı';
}

export function nextLoopMode(mode) {
  return LOOP_CYCLE[mode ?? 'off'] ?? 'queue';
}

const divider = () =>
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const text = (content) => new TextDisplayBuilder().setContent(content);

const button = (action, emoji, label, { style = ButtonStyle.Secondary, disabled = false } = {}) =>
  new ButtonBuilder()
    .setCustomId(`${PANEL_PREFIX}${action}`)
    .setEmoji(emoji)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);

/** Panelin buton satırları. `check.js` emoji doğrulaması için de kullanıyor. */
export function buildPanelRows(player, guildId) {
  const loopOn = (player?.repeatMode ?? 'off') !== 'off';
  const autoplayOn = isAutoplayEnabled(guildId);
  const volume = player?.volume ?? 100;

  return [
    new ActionRowBuilder().addComponents(
      button('loop', '🔁', 'Tekrar', {
        style: loopOn ? ButtonStyle.Success : ButtonStyle.Secondary,
      }),
      button('shuffle', '🔀', 'Karıştır'),
      button('autoplay', '♾️', 'Oto. çalma', {
        style: autoplayOn ? ButtonStyle.Success : ButtonStyle.Secondary,
      }),
      button('stop', '⏹️', 'Durdur', { style: ButtonStyle.Danger }),
    ),
    new ActionRowBuilder().addComponents(
      button('volDown', '🔉', 'Ses −', { disabled: volume <= 10 }),
      button('volUp', '🔊', 'Ses +', { disabled: volume >= 150 }),
      button('queue', '📋', 'Kuyruk'),
      button('liked', '❤️', 'Beğeniler'),
    ),
  ];
}

/**
 * Panelin tamamı: çalan parça, ayarlar, kuyruk listesi, kısayol butonları.
 * `status` son yapılan işlemin tek satırlık geri bildirimi.
 */
export function buildPanelPayload(player, guildId, { status = null } = {}) {
  const current = player?.queue?.current ?? null;
  const queued = player?.queue?.tracks ?? [];
  const paused = Boolean(player?.paused);

  const container = new ContainerBuilder()
    .setAccentColor(paused ? COLORS.warning : COLORS.primary)
    .addTextDisplayComponents(text('## 🎛️  Kontrol Paneli'));

  if (status) container.addTextDisplayComponents(text(`-# ${status}`));

  container
    .addTextDisplayComponents(
      text(
        current
          ? `**${truncate(current.info?.title, 80)}** — ${truncate(current.info?.author, 40)}\n\`${formatDuration(player.position)} / ${formatDuration(current.info?.duration)}\``
          : 'Şu an çalan bir parça yok.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `Ses **%${player?.volume ?? 100}**`,
          `Tekrar **${loopLabel(player?.repeatMode)}**`,
          `Oto. çalma **${isAutoplayEnabled(guildId) ? 'Açık' : 'Kapalı'}**`,
        ].join('  •  '),
      ),
    );

  const lines = queued
    .slice(0, 10)
    .map(
      (track, index) =>
        `\`${String(index + 1).padStart(2, ' ')}.\` ${truncate(track.info?.title, 50)} \`${formatDuration(track.info?.duration)}\``,
    );

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(`**Kuyruk (${queued.length})**${lines.length ? `\n${lines.join('\n')}` : '\nboş'}`),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(...buildPanelRows(player, guildId));

  return { components: [container], flags: V2_EPHEMERAL };
}
