import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { errorEmbed } from '../music/embeds.js';
import { nowPlayingPayload } from '../music/card.js';
import { rememberNowPlaying } from '../music/nowPlaying.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Çalan parçanın kartını gösterir'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);
    const track = player?.queue?.current;

    if (!track) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalan bir parça yok.')], ...EPHEMERAL });
    }

    const message = await interaction.reply(nowPlayingPayload(player, track));

    // Bu mesajı "canlı kart" yap: parça değişince burası güncellenir.
    rememberNowPlaying(interaction.guild.id, message.channelId, message.id);
    return;
  },
};
