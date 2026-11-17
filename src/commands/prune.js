import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

export default {
  data: new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Kanaldan toplu mesaj siler (son 100, 14 günden eski olanlar silinemez)')
    .addIntegerOption((option) =>
      option
        .setName('adet')
        .setDescription('Kaç mesaj silinsin (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Sadece bu kişinin mesajlarını sil')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const amount = interaction.options.getInteger('adet', true);
    const target = interaction.options.getUser('kullanici');
    const channel = interaction.channel;

    if (!channel?.isTextBased?.() || channel.isDMBased?.()) {
      return interaction.reply({
        embeds: [errorEmbed('Bu komut sadece sunucu metin kanallarında çalışır.')],
        ...EPHEMERAL,
      });
    }

    const me = interaction.guild.members.me;
    const permissions = channel.permissionsFor(me);
    if (
      !permissions?.has(PermissionFlagsBits.ManageMessages) ||
      !permissions?.has(PermissionFlagsBits.ReadMessageHistory)
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            'Bu kanalda **Mesajları Yönet** ve **Mesaj Geçmişini Gör** iznim yok. Kanal izinlerini kontrol et.',
          ),
        ],
        ...EPHEMERAL,
      });
    }

    await interaction.deferReply(EPHEMERAL);

    try {
      let deleted;

      if (target) {
        // Belirli kişinin mesajları: son 100 mesajı çek, filtrele.
        const fetched = await channel.messages.fetch({ limit: 100 });
        const matching = fetched
          .filter(
            (message) =>
              message.author.id === target.id &&
              Date.now() - message.createdTimestamp < TWO_WEEKS,
          )
          .first(amount);
        deleted = await channel.bulkDelete(matching, true);
      } else {
        deleted = await channel.bulkDelete(amount, true);
      }

      const count = deleted?.size ?? 0;
      const skipped = amount - count;

      return interaction.editReply({
        embeds: [
          {
            color: count ? COLORS.success : COLORS.warning,
            description: count
              ? `🧹 **${count} mesaj** silindi.${skipped > 0 ? ` (${skipped} tanesi 14 günden eski olduğu için atlandı)` : ''}`
              : 'Silinecek mesaj bulunamadı (14 günden eski mesajlar toplu silinemez).',
          },
        ],
      });
    } catch (error) {
      const reason = String(error?.message ?? error).slice(0, 200);
      return interaction.editReply({
        embeds: [errorEmbed(`Mesajlar silinemedi.\n\`\`\`${reason}\`\`\``)],
      });
    }
  },
};
