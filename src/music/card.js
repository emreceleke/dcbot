import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

import {
  COLORS,
  formatDuration,
  progressBar,
  requesterMention,
  trackArtist,
  trackArtwork,
  truncate,
} from './embeds.js';

/**
 * Discord Components V2 (IsComponentsV2).
 *
 * V2'de embed yoktur: her şey tek bir "Container" içindedir. Bu sayede
 * butonlar, ayırıcı çizgiler, thumbnail ve footer AYNI kartın içinde durur.
 * Fotoğraftaki görünüm bunu kullanıyor.
 *
 * Kural: V2 mesajında `embeds` veya `content` KULLANILAMAZ; sadece
 * `components` + `flags: IsComponentsV2` gönderilir.
 */
export const MUSIC_BUTTON_PREFIX = 'music:';
export const V2 = MessageFlags.IsComponentsV2;
export const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const divider = () =>
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const text = (content) => new TextDisplayBuilder().setContent(content);

/**
 * Tek satır buton: [⏮️] [⏸️] [⏭️] [❤️] [🎛️]
 *
 * Discord'da buton üzerine gelince çıkan bir "ipucu" (tooltip) yok; tek yol
 * butonun üstündeki yazı. Burada sadece ikon var, açıklamalar `/help` içinde.
 */
export function buildControlRows(player) {
  const current = player?.queue?.current ?? null;
  const paused = Boolean(player?.paused);
  const hasPrevious = (player?.queue?.previous?.length ?? 0) > 0;
  const idle = !current;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}previous`)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle || !hasPrevious),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}pause`)
      .setEmoji(paused ? '▶️' : '⏸️')
      // Yeşil (Success) arka plan yok: duraklat/devam aynı gri butonda.
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}skip`)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}like`)
      .setEmoji('❤️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle),

    new ButtonBuilder()
      .setCustomId(`${MUSIC_BUTTON_PREFIX}panel`)
      .setEmoji('🎛️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(idle),
  );

  return [row];
}

/**
 * "Şimdi Çalıyor" kartı. Butonlar konteynerin İÇİNDE.
 *
 *   🎵 Şimdi Çalıyor          (subtext başlık)
 *   ## Parça adı              ┐ section + thumbnail
 *   Sanatçı                   ┘
 *   ────────────────
 *   `3:43`  ▬▬🔘▬▬  `4:17`
 *   [⏮️] [⏸️] [⏭️] [❤️] [🎛️]
 *   ────────────────
 *   Sıradaki: ... | 📋 19 parça | Ekleyen: @kişi
 */
export function nowPlayingComponents(player, track) {
  const info = track?.info ?? {};
  const position = player?.position ?? 0;
  const duration = info.duration ?? 0;
  const queueLength = player?.queue?.tracks?.length ?? 0;
  const next = player?.queue?.tracks?.[0];
  const paused = Boolean(player?.paused);
  const artwork = trackArtwork(track);

  const heading = text(`## ${truncate(info.title, 200)}\n${truncate(trackArtist(track), 60)}`);

  const container = new ContainerBuilder()
    .setAccentColor(paused ? COLORS.warning : COLORS.primary)
    .addTextDisplayComponents(text(paused ? '-# ⏸️  Duraklatıldı' : '-# 🎵  Şimdi Çalıyor'));

  // Section'ın accessory'si zorunlu; kapak yoksa düz metin olarak ekle.
  if (artwork) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(heading)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(artwork).setDescription('Albüm kapağı')),
    );
  } else {
    container.addTextDisplayComponents(heading);
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `\`${formatDuration(position)}\`  ${progressBar(position, duration)}  \`${formatDuration(duration)}\``,
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(...buildControlRows(player))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        next
          ? `-# Sıradaki: ${truncate(next.info?.title, 30)} | 📋 ${queueLength} parça | Ekleyen: ${requesterMention(track)}`
          : `-# Kuyrukta bekleyen parça yok. | Ekleyen: ${requesterMention(track)}`,
      ),
    );

  return [container];
}

/** Kart için hazır mesaj gövdesi: { components, flags } */
export function nowPlayingPayload(player, track) {
  return { components: nowPlayingComponents(player, track), flags: V2 };
}

/**
 * Sadece metin + isteğe bağlı buton satırı içeren basit kart
 * (kuyruk bitti, "kuyruğa eklendi" özeti vb.).
 */
export function textCard(content, { rows = [], accent = COLORS.primary } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents(text(content));

  if (rows.length) container.addActionRowComponents(...rows);

  return { components: [container], flags: V2 };
}

export function isMusicButton(customId) {
  return typeof customId === 'string' && customId.startsWith(MUSIC_BUTTON_PREFIX);
}
