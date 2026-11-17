import { MessageFlags } from 'discord.js';
import { log } from '../config.js';
import { COLORS, errorEmbed, historyEmbed, queueEmbed, truncate } from './embeds.js';
import { nowPlayingPayload, textCard } from './card.js';
import { buildPanelPayload, loopLabel, nextLoopMode } from './panel.js';
import { likedPayload } from './likedView.js';
import { getHistory } from './history.js';
import { refreshPauseState } from './nowPlaying.js';
import { canControl } from './player.js';
import { isAutoplayEnabled, setAutoplay } from './settings.js';
import { listLikes, toggleLike } from './likes.js';
import { findRecommendations } from '../recommend/engine.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const LOOP_CYCLE = { off: 'queue', queue: 'track', track: 'off' };
const LOOP_LABELS = { off: 'Kapalı', queue: 'Kuyruk', track: 'Tek parça' };

/** "Şimdi Çalıyor" kartındaki ve panel içindeki butonları işler. */
export async function handleMusicButton(interaction, client) {
  const action = interaction.customId.slice('music:'.length);
  const player = client.lavalink.getPlayer(interaction.guildId);
  const current = player?.queue?.current;

  // Panel kısayolları (music:cmd:...) çalan parça olmasa da açılabilir.
  if (action.startsWith('cmd:')) {
    if (!player) {
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

    return handlePanelShortcut(interaction, client, player, action.slice('cmd:'.length));
  }

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
      return interaction.reply(buildPanelPayload(player, interaction.guildId));

    default:
      log.warn(`Bilinmeyen müzik butonu: ${interaction.customId}`);
      return interaction.reply({ embeds: [errorEmbed('Bilinmeyen işlem.')], ...EPHEMERAL });
  }
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

  // Kart zaten tekrar modunu buton renginde ve panelde gösteriyor.
  await interaction.update(nowPlayingPayload(player, player.queue.current));
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

  // Kartın footer'ı ve kuyruk sayısı hemen yansısın.
  interaction.message
    ?.edit(nowPlayingPayload(player, player.queue.current))
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

/**
 * 🎛️ Kontrol Paneli kısayolları.
 *
 * Discord butonu sohbete komut yazamaz; aynı işi burada yapıp paneli
 * `interaction.update()` ile tazeliyoruz. Böylece `/loop`, `/shuffle`,
 * `/volume`, `/autoplay`, `/queue`, `/liked`, `/stop`, `/pause` komutlarının
 * tamamı tek panelden erişilebilir.
 */
async function handlePanelShortcut(interaction, client, player, action) {
  const guildId = interaction.guildId;
  let status = null;

  switch (action) {
    case 'loop': {
      const next = nextLoopMode(player.repeatMode);
      await player.setRepeatMode(next);
      status = `🔁 Tekrar: **${loopLabel(next)}**`;
      break;
    }

    case 'shuffle': {
      const count = player.queue.tracks?.length ?? 0;
      if (!count) {
        status = '🔀 Kuyruk boş, karıştırılacak parça yok.';
        break;
      }
      await player.queue.shuffle();
      status = `🔀 ${count} parça karıştırıldı.`;
      break;
    }

    case 'autoplay': {
      const next = !isAutoplayEnabled(guildId);
      setAutoplay(guildId, next);
      status = `♾️ Oto. çalma: **${next ? 'Açık' : 'Kapalı'}**`;
      break;
    }

    case 'volDown':
    case 'volUp': {
      const delta = action === 'volUp' ? 10 : -10;
      const level = Math.min(150, Math.max(0, (player.volume ?? 100) + delta));
      await player.setVolume(level);
      status = `🔊 Ses: **%${level}**`;
      break;
    }

    case 'queue':
      return interaction.reply({ embeds: [queueEmbed(player, 0)], ...EPHEMERAL });

    case 'liked': {
      const likes = await listLikes(interaction.user.id);
      if (!likes.length) {
        return interaction.reply({
          embeds: [errorEmbed('Hiç beğenin yok. Karttaki ❤️ butonuna bas.')],
          ...EPHEMERAL,
        });
      }
      return interaction.reply(likedPayload(likes));
    }

    case 'history': {
      const entries = await getHistory(guildId);
      if (!entries.length) {
        return interaction.reply({
          embeds: [errorEmbed('Henüz çalınan bir parça yok.')],
          ...EPHEMERAL,
        });
      }
      return interaction.reply({ embeds: [historyEmbed(entries)], ...EPHEMERAL });
    }

    case 'stop': {
      await player.stopPlaying(true, false);
      await player.destroy();
      // Panel V2 mesajı: embed ile değiştirilemez, aynı formatta cevap ver.
      return interaction.update(
        textCard('⏹️  **Durduruldu.** Yeni şarkı için `/play` kullan.', {
          accent: COLORS.warning,
        }),
      );
    }

    default:
      log.warn(`Bilinmeyen panel kısayolu: ${interaction.customId}`);
      return interaction.reply({ embeds: [errorEmbed('Bilinmeyen işlem.')], ...EPHEMERAL });
  }

  return interaction.update(buildPanelPayload(player, guildId, { status }));
}
