import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed, likedEmbed } from '../music/embeds.js';
import { getOrCreatePlayer } from '../music/player.js';
import { listLikes } from '../music/likes.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('liked')
    .setDescription('Beğendiğin şarkıları gösterir veya kuyruğa alır')
    .addBooleanOption((option) =>
      option
        .setName('cal')
        .setDescription('Beğenilenleri kuyruğa al ve çalmaya başla')
        .setRequired(false),
    ),

  async execute(interaction, client) {
    const likes = await listLikes(interaction.user.id);

    if (!likes.length) {
      return interaction.reply({
        embeds: [
          errorEmbed('Hiç beğenin yok. Şimdi çalıyor kartındaki ❤️ butonuna bas.'),
        ],
        ...EPHEMERAL,
      });
    }

    const shouldPlay = interaction.options.getBoolean('cal') ?? false;

    if (!shouldPlay) {
      return interaction.reply({ embeds: [likedEmbed(likes)], ...EPHEMERAL });
    }

    await interaction.deferReply();

    const { player, error } = await getOrCreatePlayer(client, interaction);
    if (error) return interaction.editReply({ embeds: [errorEmbed(error)] });

    let added = 0;
    for (const entry of likes) {
      try {
        const result = await player.search(entry.uri ?? `${entry.author} ${entry.title}`, interaction.user);
        const track = result?.tracks?.[0];
        if (!track) continue;
        await player.queue.add(track);
        added += 1;
      } catch {
        // tek tek parça başarısız olabilir, devam et
      }
    }

    if (!added) {
      return interaction.editReply({
        embeds: [errorEmbed('Beğenilen şarkılar çözülemedi. Kaynaklar kaldırılmış olabilir.')],
      });
    }

    if (!player.playing && !player.paused) await player.play();

    return interaction.editReply({
      embeds: [
        {
          color: COLORS.success,
          description: `❤️ ${added} beğenilen şarkı kuyruğa eklendi.`,
        },
      ],
    });
  },
};
