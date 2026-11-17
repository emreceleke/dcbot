import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const MUSIC_BUTTON_PREFIX = 'music:';

/**
 * "Şimdi Çalıyor" kartının altındaki iki buton satırı.
 *
 * customId'ler sabittir (collector değil): buton, bot yeniden başlasa bile
 * çalışır, çünkü işlem sunucu ID'sinden player'ı bulur.
 */
export function buildControlRows(player, { liked = false } = {}) {
  const current = player?.queue?.current ?? null;
  const paused = Boolean(player?.paused);
  const mode = player?.repeatMode ?? 'off';
  const hasPrevious = (player?.queue?.previous?.length ?? 0) > 0;
  const idle = !current;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}previous`)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle || !hasPrevious),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}pause`)
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}skip`)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}loop`)
      .setEmoji('🔁')
      .setStyle(mode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(idle),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}like`)
      .setEmoji(liked ? '💚' : '❤️')
      .setStyle(liked ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(idle || liked),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}similar`)
      .setEmoji('✨')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}panel`)
      .setEmoji('🎛️')
      .setLabel('Kontrol paneli')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(idle),
  );

  return [row1, row2];
}

export function isMusicButton(customId) {
  return typeof customId === 'string' && customId.startsWith(MUSIC_BUTTON_PREFIX);
}
