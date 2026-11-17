import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ses seviyesini görür veya ayarlar')
    .addIntegerOption((option) =>
      option
        .setName('seviye')
        .setDescription('0-150 arası')
        .setMinValue(0)
        .setMaxValue(150),
    ),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalmıyorum.')], ...EPHEMERAL });
    }

    const level = interaction.options.getInteger('seviye');

    if (level === null) {
      return interaction.reply({
        embeds: [{ color: COLORS.primary, description: `🔊 Ses seviyesi: **${player.volume}%**` }],
      });
    }

    await player.setVolume(level);
    return interaction.reply({
      embeds: [{ color: COLORS.success, description: `🔊 Ses seviyesi **${level}%** olarak ayarlandı.` }],
    });
  },
};
