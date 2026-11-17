import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../music/embeds.js';
import { canControl } from '../music/player.js';
import { finishNowPlaying } from '../music/nowPlaying.js';

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Çalmayı durdurur, kuyruğu temizler ve kanaldan çıkar'),

  async execute(interaction, client) {
    const player = client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      return interaction.reply({ embeds: [errorEmbed('Zaten çalmıyorum.')], ...EPHEMERAL });
    }

    if (!canControl(interaction, player)) {
      return interaction.reply({
        embeds: [errorEmbed('Sadece botun çaldığı ses kanalındakiler durdurabilir.')],
        ...EPHEMERAL,
      });
    }

    await interaction.deferReply();

    // Sahnede kalan kartı "durduruldu" durumuna çek, sonra oynatıcıyı kaldır.
    await finishNowPlaying(
      client,
      interaction.guild.id,
      player,
      '⏹️  **Durduruldu.** Yeni şarkı için `/play` kullan.',
    );

    // stopPlaying(clearQueue, executeAutoplay) -> kuyruğu boşaltır, autoplay tetiklemez.
    await player.stopPlaying(true, false);
    await player.destroy();

    return interaction.editReply({
      embeds: [{ color: COLORS.success, description: '⏹️ Durduruldu ve kanaldan çıkıldı.' }],
    });
  },
};
