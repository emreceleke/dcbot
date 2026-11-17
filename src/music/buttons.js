import { MessageFlags } from 'discord.js';
import { log } from '../config.js';
import { COLORS, errorEmbed, formatDuration, truncate, nowPlayingCard } from './embeds.js';
import { buildControlRows } from './controls.js';
import { refreshPauseState } from './nowPlaying.js';
import { canControl } from './player.js';
import { isAutoplayEnabled } from './settings.js';
import { toggleLike } from './likes.js';
import { findRecommendations } from '../recommend/engine.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const LOOP_CYCLE = { off: 'queue', queue: 'track', track: 'off' };
const LOOP_LABELS = { off: 'Kapalı', queue: 'Kuyruk', track: 'Tek parça' };

/** "Şimdi Çalıyor" kartındaki butonları işler. */
export async function handleMusicButton(interaction, client) {
  const action = interaction.customId.slice('music:'.length);
  const player = client.lavalink.getPlayer(interaction.guildId);
  const current = player?.queue?.current;

  if (!player || !current) {
    return interaction.reply({
      embeds: [errorEmbed('Şu an çalan bir parça yok.')],
      ...EPHEMERAL,
    });
  }

  if (!canControl(interaction, player)) {
    return interaction.reply({
      embeds: [errorEmbed('Sadece botun çaldığı ses kanalındakiler kontrol edebilir.')],
      ...EPHEMERAL,
    });
  }

  switch (action) {
    case 'pause':
      if (player.paused) await player.resume();
      else await player.pause();
      return refreshPauseState(interaction, player);

    case 'skip':
      return handleSkip(interaction, player);

    case 'previous':
      return handlePrevious(interaction, player);

    case 'loop':
      return handleLoop(interaction, player);

    case 'like':
      return handleLike(interaction, player, current);

    case 'similar':
      return handleSimilar(interaction, player, current);

    case 'panel':
      return handlePanel(interaction, player);

    default:
      log.warn(`Bilinmeyen müzik butonu: ${interaction.customId}`);
      return interaction.reply({ embeds: [errorEmbed('Bilinmeyen işlem.')], ...EPHEMERAL });
  }
}

/** Kartı, basılan mesajda tazeler (parça değişmeden). */
async function updatePressedCard(interaction, player) {
  await interaction.update({
    embeds: [
      nowPlayingCard(player, player.queue.current, {
        autoplay: isAutoplayEnabled(interaction.guildId),
      }),
    ],
    components: buildControlRows(player),
  });
}

async function handleSkip(interaction, player) {
  await interaction.deferUpdate();

  // Tekrar "tek parça" modundaysa atlama aynı şarkıyı baştan çalar; kapat.
  if (player.repeatMode === 'track') await player.setRepeatMode('off');

  // trackStart olayı kartı günceller; sırada parça yoksa queueEnd devralır.
  await player.skip();
}

async function handlePrevious(interaction, player) {
  await interaction.deferUpdate();

  const previous = await player.queue.shiftPrevious();
  if (!previous) {
    return interaction.followUp({ embeds: [errorEmbed('Önceki parça yok.')], ...EPHEMERAL });
  }

  if (player.repeatMode === 'track') await player.setRepeatMode('off');

  // Çalan parçayı kuyruğun başına koy: ileri/geri gezinebilmek için.
  if (player.queue.current) await player.queue.add(player.queue.current, 0);

  await player.play({ clientTrack: previous });
}

async function handleLoop(interaction, player) {
  const next = LOOP_CYCLE[player.repeatMode ?? 'off'] ?? 'queue';
  await player.setRepeatMode(next);
  return updatePressedCard(interaction, player);
}

async function handleLike(interaction, player, track) {
  const { liked, count } = await toggleLike(interaction.user.id, track);

  await interaction.reply({
    embeds: [
      {
        color: liked ? COLORS.success : COLORS.warning,
        description: liked
          ? `❤️ **${truncate(track.info?.title, 80)}** beğenilenlere eklendi. (${count} parça)\n\`/liked\` ile hepsini kuyruğa alabilirsin.`
          : `💔 **${truncate(track.info?.title, 80)}** beğenilerden çıkarıldı. (${count} parça)`,
      },
    ],
    ...EPHEMERAL,
  });

  // Butonları tazele (duruma göre).
  interaction.message?.edit({ components: buildControlRows(player) }).catch(() => {});
}

async function handleSimilar(interaction, player, current) {
  await interaction.deferReply(EPHEMERAL);

  const { source, tracks } = await findRecommendations(player, current, { limit: 8 });

  if (!tracks.length) {
    return interaction.editReply({
      embeds: [errorEmbed('Bu parça için benzer şarkı bulunamadı.')],
    });
  }

  await player.queue.add(tracks);
  if (!player.playing && !player.paused) await player.play();

  // Sıradaki parça bilgisi ve butonlar hemen yansısın.
  interaction.message
    ?.edit({
      embeds: [
        nowPlayingCard(player, player.queue.current, {
          autoplay: isAutoplayEnabled(interaction.guildId),
        }),
      ],
      components: buildControlRows(player),
    })
    .catch(() => {});

  const list = tracks
    .map(
      (track, index) =>
        `${index + 1}. **${truncate(track.info?.title, 70)}** — ${truncate(track.info?.author, 40)}`,
    )
    .join('\n');

  return interaction.editReply({
    embeds: [
      {
        color: COLORS.success,
        title: `Benzer parçalar kuyruğa eklendi (${tracks.length})`,
        description: list,
        footer: {
          text: source === 'lastfm' ? 'Kaynak: Last.fm dinleme verisi' : 'Kaynak: YouTube Radio mix',
        },
      },
    ],
  });
}

async function handlePanel(interaction, player) {
  const current = player.queue.current;
  const queued = player.queue.tracks;

  const lines = queued
    .slice(0, 10)
    .map(
      (track, index) =>
        `\`${String(index + 1).padStart(2, ' ')}.\` [${truncate(track.info?.title, 55)}](${track.info?.uri ?? 'https://discord.com'}) \`${formatDuration(track.info?.duration)}\``,
    );

  const embed = {
    color: COLORS.primary,
    title: '🎛️  Kontrol Paneli',
    fields: [
      {
        name: 'Şu an çalan',
        value: current
          ? `[${truncate(current.info?.title, 70)}](${current.info?.uri ?? 'https://discord.com'})\n\`${formatDuration(player.position)} / ${formatDuration(current.info?.duration)}\``
          : 'bir şey çalmıyor',
      },
      {
        name: 'Ayarlar',
        value: [
          `🔊 Ses: **%${player.volume}**`,
          `🔁 Tekrar: **${LOOP_LABELS[player.repeatMode ?? 'off']}**`,
          `♾️ Otomatik çalma: **${isAutoplayEnabled(interaction.guildId) ? 'açık' : 'kapalı'}**`,
        ].join('\n'),
      },
      {
        name: `Kuyruk (${queued.length})`,
        value: lines.length ? lines.join('\n') : 'boş',
      },
    ],
    footer: { text: 'Kuyruğun tamamı için /queue' },
  };

  return interaction.reply({ embeds: [embed], ...EPHEMERAL });
}
