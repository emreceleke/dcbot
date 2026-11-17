import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';
import { canControl } from '../music/player.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Çalan parçayı atlar (birden fazla sayı verebilirsin)')
    .addIntegerOption((option) =>
      option
        .setName('adet')
        .setDescription('Kaç parça atlanacak')
        .setMinValue(1)
        .setMaxValue(20),
    ),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player?.queue?.current) {
      return interaction.reply({ embeds: [errorEmbed('Şu an çalan bir parça yok.')], ...EPHEMERAL });
    }

    const amount = interaction.options.getInteger('adet') ?? 1;

    if (!canControl(interaction, player)) {
      return interaction.reply({
        embeds: [errorEmbed('Sadece botun çaldığı ses kanalındakiler atlayabilir.')],
        ...EPHEMERAL,
      });
    }

    await interaction.deferReply();

    // Tekrar modu "track" ise atlama işe yaramaz (aynı parça yeniden başlar).
    if (player.repeatMode === 'track') await player.setRepeatMode('off');

    // amount-1 kadar kuyruktan baştan parça çıkar, sonra mevcut parçayı atla.
    if (amount > 1) {
      const extra = Math.min(amount - 1, player.queue.tracks.length);
      if (extra > 0) await player.queue.splice(0, extra);
    }

    const upcoming = player.queue.tracks[0];
    await player.skip();

    return interaction.editReply({
      embeds: [
        {
          color: COLORS.success,
          description: upcoming
            ? `⏭️ Geçildi. Sıradaki: **${upcoming.info?.title ?? 'bilinmiyor'}**`
            : '⏭️ Geçildi. Kuyrukta başka parça yok.',
        },
      ],
    });
  },
};
