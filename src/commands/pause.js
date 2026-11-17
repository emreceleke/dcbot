import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Çalmayı duraklatır veya devam ettirir'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player?.queue?.current) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalan bir parça yok.')], ...EPHEMERAL });
    }

    if (player.paused) {
      await player.resume();
      return interaction.reply({
        embeds: [{ color: COLORS.success, description: '▶️ Devam ediliyor.' }],
      });
    }

    await player.pause();
    return interaction.reply({
      embeds: [{ color: COLORS.warning, description: '⏸️ Duraklatıldı.' }],
    });
  },
};
