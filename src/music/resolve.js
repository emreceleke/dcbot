import { config } from '../config.js';

const URL_RE = /^https?:\/\//i;
const SPOTIFY_RE = /^https?:\/\/(?:open\.)?spotify\.com\//i;

export function isUrl(input) {
  return URL_RE.test(input.trim());
}

export function isSpotify(input) {
  return SPOTIFY_RE.test(input.trim());
}

/**
 * Kullanıcı girdisini Lavalink'in anlayacağı bir arama tanımlayıcısına çevirir.
 *
 * - Tam URL  -> olduğu gibi gönderilir (Lavalink YouTube/SoundCloud/direct çözer,
 *               playlist linkleri de bu yolla gelir).
 * - Düz metin -> "<platform>:<metin>" arama sorgusuna dönüşür.
 *
 * Lavalink, kaynak öneki verilmediğinde varsayılan kaynağı kullanır; önekli
 * string'ler REST identifier olarak aynen kabul edilir.
 */
export function buildIdentifier(input) {
  const query = input.trim();
  if (isUrl(query)) return query;
  return `${config.searchPlatform}:${query}`;
}

/**
 * Lavalink parçalarından arama sonucu mu yoksa playlist mi geldiğini ayırt eder.
 * SearchResult.playlist -> PlaylistInfo | null  (dikkat: `playlistInfo` DEĞİL)
 */
export function describeResult(result) {
  const count = result?.tracks?.length ?? 0;
  const isPlaylist = result?.loadType === 'playlist' && result?.playlist;

  if (isPlaylist) {
    return { kind: 'playlist', name: result.playlist.name, count };
  }

  return { kind: count > 1 ? 'search' : 'track', name: null, count };
}

/** Lavalink'in hangi kaynaktan çözdüğünü insan okunur hale getirir. */
export function sourceLabel(result) {
  const sourceName = result?.tracks?.[0]?.info?.sourceName;
  if (!sourceName) return 'bilinmiyor';
  return sourceName;
}
