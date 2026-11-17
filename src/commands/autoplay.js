import { SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../music/embeds.js';
import { isAutoplayEnabled, setAutoplay } from '../music/settings.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Kuyruk bittiğinde benzer şarkılarla devam etmeyi açar/kapatır')
    .addBooleanOption((option) =>
      option.setName('acik').setDescription('Açık mı olsun?').setRequired(false),
    ),

  async execute(interaction) {
    const requested = interaction.options.getBoolean('acik');
    const next = requested ?? !isAutoplayEnabled(interaction.guild.id);
    setAutoplay(interaction.guild.id, next);

    return interaction.reply({
      embeds: [
        {
          color: next ? COLORS.success : COLORS.warning,
          description: next
            ? '🔁 Autoplay **açık**. Kuyruk bittiğinde benzer şarkılar eklenir.'
            : '⏹️ Autoplay **kapalı**. Kuyruk bitince bot susar.',
        },
      ],
    });
  },
};
