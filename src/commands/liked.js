import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed, truncate } from '../music/embeds.js';
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
      const shown = likes.slice(0, 20);
      const list = shown
        .map((entry, index) => `${index + 1}. [${truncate(entry.title, 60)}](${entry.uri ?? 'https://discord.com'}) — ${truncate(entry.author, 40)}`)
        .join('\n');

      return interaction.reply({
        embeds: [
          {
            color: COLORS.primary,
            title: `❤️  Beğendiğin şarkılar (${likes.length})`,
            description: list,
            footer:
              likes.length > shown.length
                ? { text: `İlk ${shown.length} tanesi gösteriliyor • /liked cal:true ile çal` }
                : { text: '/liked cal:true ile hepsini kuyruğa al' },
          },
        ],
        ...EPHEMERAL,
      });
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
