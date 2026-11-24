import { SlashCommandBuilder } from 'discord.js';
import { config, log } from '../config.js';
import { buildIdentifier, describeResult, isSpotify } from '../music/resolve.js';
import { getOrCreatePlayer } from '../music/player.js';
import { COLORS, truncate } from '../music/embeds.js';
import { nowPlayingPayload, textCard } from '../music/card.js';
import { addFillerTracks, addManualTracks } from '../music/queueAdd.js';
import { rememberNowPlaying } from '../music/nowPlaying.js';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Şarkı çalar: arama metni, YouTube/SoundCloud linki veya playlist')
    .addStringOption((option) =>
      option
        .setName('sorgu')
        .setDescription('Şarkı adı, sanatçı, link veya playlist linki')
        .setRequired(true),
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    const raw = interaction.options.getString('sorgu', true).trim();

    if (isSpotify(raw)) {
      return interaction.editReply({
        embeds: [
          {
            color: COLORS.warning,
            description:
              'Spotify linkleri bu botta kapalı (Spotify API artık Premium + kısıtlı endpoint şartı koyuyor).\n' +
              'Aynı şarkıyı **YouTube** veya **SoundCloud** linki ya da şarkı adı olarak ver.',
          },
        ],
      });
    }

    const { player, error } = await getOrCreatePlayer(client, interaction);
    if (error) {
      return interaction.editReply({ embeds: [{ color: COLORS.danger, description: error }] });
    }

    let result;
    try {
      result = await player.search(buildIdentifier(raw), interaction.user);
    } catch (searchError) {
      log.error('Arama başarısız:', searchError?.message ?? searchError);
      return interaction.editReply({
        embeds: [
          {
            color: COLORS.danger,
            description: 'Arama sırasında hata oluştu. Lavalink düğümü sağlıklı mı?',
          },
        ],
      });
    }

    if (!result?.tracks?.length) {
      return interaction.editReply({
        embeds: [
          { color: COLORS.warning, description: `Sonuç bulunamadı: \`${truncate(raw, 80)}\`` },
        ],
      });
    }

    const tracks = result.tracks.slice(0, config.maxPlaylistSize);
    const info = describeResult(result);
    const wasIdle = !player.playing && !player.paused;

    // Arama sonucunda ilk parça istenen şarkı, kalanı "benzer sonuç" dolgusu.
    // Playlist/link ise kullanıcının seçtiği bütün parçalar elle eklenmiş sayılır.
    const requested = info.kind === 'search' ? tracks.slice(0, 1) : tracks;
    const filler = info.kind === 'search' ? tracks.slice(1) : [];

    await addManualTracks(player, requested);

    if (wasIdle) await player.play();

    // Dolgu, elle eklenenlerin arkasına girer; sıradaki şarkı hep senin seçtiğin olur.
    await addFillerTracks(player, filler);

    // Çalmaya bu istekle başladıysa tam kartı gönder ve onu "canlı" olarak kaydet.
    if (wasIdle) {
      const message = await interaction.editReply(nowPlayingPayload(player, tracks[0]));
      rememberNowPlaying(interaction.guild.id, message.channelId, message.id);
      return;
    }

    // Zaten bir şey çalıyordu: kısa özet (buton yok, kart zaten yukarıda).
    const summary =
      requested.length === 1
        ? `➕  **${truncate(requested[0].info?.title, 80)}** kuyruğa eklendi.`
        : info.kind === 'playlist' && info.name
          ? `➕  **${truncate(info.name, 80)}** (${requested.length} parça) kuyruğa eklendi.`
          : `➕  **${requested.length} parça** kuyruğa eklendi.`;

    const detail = filler.length ? `\n-# +${filler.length} benzer sonuç sıranın sonuna eklendi.` : '';

    await interaction.editReply(textCard(summary + detail));
    return;
  },
};
