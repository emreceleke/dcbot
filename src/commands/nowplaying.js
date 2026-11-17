import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed, nowPlayingCard } from '../music/embeds.js';
import { buildControlRows } from '../music/controls.js';
import { rememberNowPlaying } from '../music/nowPlaying.js';
import { isAutoplayEnabled } from '../music/settings.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Çalan parçanın detaylarını gösterir'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    const track = player?.queue?.current;

    if (!track) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalan bir parça yok.')], ...EPHEMERAL });
    }

    const message = await interaction.reply({
      embeds: [
        nowPlayingCard(player, track, { autoplay: isAutoplayEnabled(interaction.guild.id) }),
      ],
      components: buildControlRows(player),
    });

    // Bu mesajı "canlı kart" yap: parça değişince burası güncellenir.
    rememberNowPlaying(interaction.guild.id, message.channelId, message.id);
    return;
  },
};
