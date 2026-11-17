import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { errorEmbed, queueEmbed } from '../music/embeds.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Kuyruğu gösterir')
    .addIntegerOption((option) =>
      option.setName('sayfa').setDescription('Sayfa numarası').setMinValue(1),
    ),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      return interaction.reply({ embeds: [errorEmbed('Kuyruk yok, hiçbir şey çalmıyorum.')], ...EPHEMERAL });
    }

    const page = (interaction.options.getInteger('sayfa') ?? 1) - 1;
    return interaction.reply({ embeds: [queueEmbed(player, page)] });
  },
};
