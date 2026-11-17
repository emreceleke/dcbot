import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Kuyruğu rastgele karıştırır'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player?.queue?.tracks?.length) {
      return interaction.reply({ embeds: [errorEmbed('Kuyrukta karıştırılacak parça yok.')], ...EPHEMERAL });
    }

    const count = player.queue.tracks.length;
    await player.queue.shuffle();

    return interaction.reply({
      embeds: [{ color: COLORS.success, description: `🔀 ${count} parça karıştırıldı.` }],
    });
  },
};
