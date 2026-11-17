import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';
import { canControl } from '../music/player.js';
import { loopLabel, nextLoopMode } from '../music/panel.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

const DETAIL = {
  off: 'Tekrar kapalı, kuyruk bitince durur.',
  queue: 'Kuyruk bitince baştan başlar.',
  track: 'Aynı parça sürekli tekrar eder. (Atlamak için /skip)',
};

export default {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Tekrar modunu değiştirir: Kapalı → Kuyruk → Tek parça'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player?.queue?.current) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalan bir parça yok.')], ...EPHEMERAL });
    }

    if (!canControl(interaction, player)) {
      return interaction.reply({
        embeds: [errorEmbed('Sadece botun çaldığı ses kanalındakiler değiştirebilir.')],
        ...EPHEMERAL,
      });
    }

    const next = nextLoopMode(player.repeatMode);
    await player.setRepeatMode(next);

    return interaction.reply({
      embeds: [
        {
          color: next === 'off' ? COLORS.warning : COLORS.success,
          description: `🔁 Tekrar: **${loopLabel(next)}** — ${DETAIL[next]}`,
        },
      ],
    });
  },
};
