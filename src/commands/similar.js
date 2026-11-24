import { SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed, truncate } from '../music/embeds.js';
import { getRememberedTrack } from '../music/player.js';
import { addFillerTracks } from '../music/queueAdd.js';
import { findRecommendations } from '../recommend/engine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('similar')
    .setDescription('Çalan parçaya benzeyen şarkıları kuyruğa ekler')
    .addIntegerOption((option) =>
      option
        .setName('adet')
        .setDescription('Kaç parça eklensin (varsayılan 8)')
        .setMinValue(1)
        .setMaxValue(20),
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const player = client.lavalink.getPlayer(interaction.guild.id);
    const seed = player?.queue?.current ?? getRememberedTrack(interaction.guild.id);

    if (!player || !seed) {
      return interaction.editReply({
        embeds: [errorEmbed('Öneri üretebilmek için bir parça çalıyor olması gerekiyor.')],
      });
    }

    const limit = interaction.options.getInteger('adet') ?? 8;
    const { source, tracks } = await findRecommendations(player, seed, { limit });

    if (!tracks.length) {
      return interaction.editReply({
        embeds: [
          {
            color: COLORS.warning,
            description:
              'Bu parça için benzer şarkı bulunamadı.\n' +
              'Last.fm anahtarı eklemek isabet oranını ciddi biçimde artırır (`.env` → `LASTFM_API_KEY`).',
          },
        ],
      });
    }

    await addFillerTracks(player, tracks);
    if (!player.playing && !player.paused) await player.play();

    const list = tracks
      .map(
        (track, index) =>
          `${index + 1}. **${truncate(track.info?.title, 70)}** — ${truncate(track.info?.author, 40)}`,
      )
      .join('\n');

    const sourceLabel =
      source === 'lastfm' ? 'Last.fm dinleme verisi' : 'YouTube Radio mix';

    return interaction.editReply({
      embeds: [
        {
          color: COLORS.success,
          title: `Benzer parçalar eklendi (${tracks.length})`,
          description: list,
          footer: { text: `Kaynak: ${sourceLabel}` },
        },
      ],
    });
  },
};
