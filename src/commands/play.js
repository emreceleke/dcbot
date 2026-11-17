import { SlashCommandBuilder } from 'discord.js';
import { config, log } from '../config.js';
import { buildIdentifier, describeResult, isSpotify } from '../music/resolve.js';
import { getOrCreatePlayer } from '../music/player.js';
import { COLORS, truncate } from '../music/embeds.js';
import { buildControlRows, nowPlayingPayload, textCard } from '../music/card.js';
import { rememberNowPlaying } from '../music/nowPlaying.js';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Şarkı çalar: arama metni, YouTube/SoundCloud linki veya playlist')
    .addStringOption((option) =>
      option
        .setName('sorgu')
        .setDescription('Şarkı adı, sanatçı, link veya playlist linki')
        .setRequired(true),
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const raw = interaction.options.getString('sorgu', true).trim();

    if (isSpotify(raw)) {
      return interaction.editReply({
        embeds: [
          {
            color: COLORS.warning,
            description:
              'Spotify linkleri bu botta kapalı (Spotify API artık Premium + kısıtlı endpoint şartı koyuyor).\n' +
              'Aynı şarkıyı **YouTube** veya **SoundCloud** linki ya da şarkı adı olarak ver.',
          },
        ],
      });
    }

    const { player, error } = await getOrCreatePlayer(client, interaction);
    if (error) {
      return interaction.editReply({ embeds: [{ color: COLORS.danger, description: error }] });
    }

    let result;
    try {
      result = await player.search(buildIdentifier(raw), interaction.user);
    } catch (searchError) {
      log.error('Arama başarısız:', searchError?.message ?? searchError);
      return interaction.editReply({
        embeds: [
          {
            color: COLORS.danger,
            description: 'Arama sırasında hata oluştu. Lavalink düğümü sağlıklı mı?',
          },
        ],
      });
    }

    if (!result?.tracks?.length) {
      return interaction.editReply({
        embeds: [
          { color: COLORS.warning, description: `Sonuç bulunamadı: \`${truncate(raw, 80)}\`` },
        ],
      });
    }

    const tracks = result.tracks.slice(0, config.maxPlaylistSize);
    const info = describeResult(result);
    const wasIdle = !player.playing && !player.paused;

    for (const track of tracks) await player.queue.add(track);

    if (wasIdle) await player.play();

    // Çalmaya bu istekle başladıysa tam kartı gönder ve onu "canlı" olarak kaydet.
    if (wasIdle) {
      const message = await interaction.editReply(nowPlayingPayload(player, tracks[0]));
      rememberNowPlaying(interaction.guild.id, message.channelId, message.id);
      return;
    }

    // Zaten bir şey çalıyordu: kısa özet + butonlar.
    const summary =
      tracks.length === 1
        ? `➕  **${truncate(tracks[0].info?.title, 80)}** kuyruğa eklendi.`
        : info.kind === 'playlist' && info.name
          ? `➕  **${truncate(info.name, 80)}** (${tracks.length} parça) kuyruğa eklendi.`
          : `➕  **${tracks.length} parça** kuyruğa eklendi.`;

    await interaction.editReply(textCard(summary, { rows: buildControlRows(player) }));
    return;
  },
};
