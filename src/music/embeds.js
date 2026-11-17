import { EmbedBuilder } from 'discord.js';

export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
};

export function truncate(text, max = 100) {
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'canlı';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Lavalink parça bilgisinden sanatçı adını çıkarır. */
export function trackArtist(track) {
  const info = track?.info;
  if (!info) return null;
  // TrackInfo'da `author` alanı var; plugin'ler ek bilgiyi pluginInfo'da verir.
  return info.author?.trim() || track?.pluginInfo?.author?.trim() || null;
}

export function trackArtwork(track) {
  // Lavalink v4: `info.artworkUrl` (zorunlu alan, null olabilir).
  return track?.info?.artworkUrl || track?.pluginInfo?.artworkUrl || null;
}

export function trackEmbed(track, { title = 'Çalınıyor', color = COLORS.primary } = {}) {
  const info = track?.info ?? {};
  const embed = new EmbedBuilder()
    .setTitle(truncate(info.title, 250))
    .setColor(color);

  if (info.uri) embed.setURL(info.uri);

  const artwork = trackArtwork(track);
  if (artwork) embed.setThumbnail(artwork);

  embed.addFields(
    { name: 'Sanatçı', value: truncate(trackArtist(track), 60), inline: true },
    { name: 'Süre', value: formatDuration(info.duration), inline: true },
  );

  if (info.sourceName) {
    embed.setFooter({ text: `kaynak: ${info.sourceName}` });
  }

  return embed;
}

export function errorEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.danger).setDescription(message);
}

export function infoEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.primary).setDescription(message);
}

/** Kuyruğu tek bir embed'e sığdırır. */
export function queueEmbed(player, page = 0, pageSize = 10) {
  const tracks = player.queue.tracks ?? [];
  const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = tracks.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const lines = slice.map((track, index) => {
    const position = safePage * pageSize + index + 1;
    const label = `${position}. [${truncate(track.info?.title, 60)}](${track.info?.uri ?? 'https://discord.com'})`;
    return `${position === 1 && safePage === 0 ? '▶️' : '•'} ${label} \`${formatDuration(track.info?.duration)}\``;
  });

  const embed = new EmbedBuilder()
    .setTitle('Kuyruk')
    .setColor(COLORS.primary)
    .setFooter({ text: `Sayfa ${safePage + 1}/${totalPages} • ${tracks.length} parça` });

  if (player.queue.current) {
    embed.addFields({
      name: 'Şu an çalan',
      value: `[${truncate(player.queue.current.info?.title, 70)}](${player.queue.current.info?.uri ?? 'https://discord.com'})`,
    });
  }

  embed.setDescription(lines.length ? lines.join('\n') : 'Kuyruk boş.');
  return embed;
}

// ─── "Şimdi Çalıyor" kartı ──────────────────────────────────────────────────

/** İlerleme çubuğu: dolu ▬ + konum işareti 🔘 + boş ▬ */
export function progressBar(position, duration, segments = 16) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return `🔘${'▬'.repeat(segments)}`;
  }
  const ratio = Math.min(Math.max(position / duration, 0), 1);
  const filled = Math.round(ratio * segments);
  return `${'▬'.repeat(filled)}🔘${'▬'.repeat(Math.max(0, segments - filled))}`;
}

/** Parçayı isteyen kullanıcının mention'ı. */
export function requesterMention(track) {
  const id = track?.requester?.id ?? track?.requester?.user?.id ?? null;
  return id ? `<@${id}>` : 'bilinmiyor';
}

/**
 * "Şimdi Çalıyor" kartı.
 *
 * Yerleşim:
 *   [author]  Şimdi Çalıyor
 *   [title]   Parça adı            (thumbnail sağda)
 *   Sanatçı
 *   0:43  ▬▬🔘▬▬▬▬▬  4:17
 *   Ekleyen: @kişi
 *   [footer]  Sıradaki: ... | 📋 19 parça
 *
 * Butonlar embed'in içine konulamaz (Discord sınırı); aynı mesaja
 * `components` olarak eklenir ve embed'in hemen altında görünür.
 */
export function nowPlayingCard(player, track, { autoplay = false } = {}) {
  const info = track?.info ?? {};
  const position = player?.position ?? 0;
  const duration = info.duration ?? 0;
  const queueLength = player?.queue?.tracks?.length ?? 0;

  const embed = new EmbedBuilder()
    .setAuthor({ name: '🎵  Şimdi Çalıyor' })
    .setTitle(truncate(info.title, 250))
    .setColor(COLORS.primary)
    .setDescription(
      [
        `**${truncate(trackArtist(track), 60)}**`,
        '',
        `\`${formatDuration(position)}\`  ${progressBar(position, duration)}  \`${formatDuration(duration)}\``,
        '',
        `Ekleyen: ${requesterMention(track)}`,
      ].join('\n'),
    );

  if (info.uri) embed.setURL(info.uri);

  const artwork = trackArtwork(track);
  if (artwork) embed.setThumbnail(artwork);

  const next = player?.queue?.tracks?.[0];
  embed.setFooter({
    text: next
      ? `Sıradaki: ${truncate(next.info?.title, 70)} | 📋 ${queueLength} parça`
      : 'Kuyrukta bekleyen parça yok.',
  });

  return embed;
}
