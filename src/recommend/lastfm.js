import { config, log } from '../config.js';

const API_ROOT = 'https://ws.audioscrobbler.com/2.0/';

async function call(method, params) {
  if (!config.lastfmKey) return null;

  const url = new URL(API_ROOT);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', config.lastfmKey);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'dc-music-bot/1.0 (+self-hosted)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    log.warn(`Last.fm ${method} -> HTTP ${res.status}`);
    return null;
  }

  return res.json();
}

/**
 * YouTube başlıklarını Last.fm'in anlayacağı (sanatçı, parça) çiftine indirger.
 * Örnek: "Rick Astley - Never Gonna Give You Up (Official Video)"
 *   -> { artist: "Rick Astley", title: "Never Gonna Give You Up" }
 */
export function parseTrackTitle(rawTitle, rawAuthor) {
  let title = (rawTitle ?? '').trim();
  const author = (rawAuthor ?? '').trim();

  // Kanal adı zaten sanatçıysa ve başlık "Sanatçı - Şarkı" ise tekrarını temizle.
  if (author && title.toLowerCase().startsWith(author.toLowerCase())) {
    title = title.slice(author.length).replace(/^[\s\-–—:|]+/, '');
  }

  // Parantezli/köşeli etiketleri at: (Official Video), [HD], (Lyrics) ...
  title = title
    .replace(/\((?:[^()]*?(?:official|video|audio|lyric|lyrics|hd|hq|4k|remaster|mv|clip)[^()]*?)\)/gi, '')
    .replace(/\[(?:[^[\]]*?(?:official|video|audio|lyric|lyrics|hd|hq|4k|remaster|mv|clip)[^[\]]*?)\]/gi, '')
    .trim();

  // "Sanatçı - Şarkı" ayrımı varsa onu kullan, yoksa kanal adını sanatçı say.
  const dashSplit = title.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0].length <= 60) {
    return { artist: dashSplit[0].trim(), title: dashSplit.slice(1).join(' - ').trim() };
  }

  return { artist: author || null, title: title || (rawTitle ?? '').trim() };
}

/**
 * Last.fm'den benzer parçalar. Anahtar yoksa ya da sonuç gelmezse boş dizi döner
 * ve çağıran taraf YouTube Radio mix fallback'ine düşer.
 */
export async function getSimilarTracks({ artist, title, limit = 12 }) {
  if (!artist || !title) return [];

  const data = await call('track.getSimilar', {
    artist,
    track: title,
    limit,
    autocorrect: 1,
  });

  const list = data?.similartracks?.track;
  if (!Array.isArray(list)) return [];

  return list
    .map((entry) => ({
      artist: entry?.artist?.name?.trim() ?? null,
      title: entry?.name?.trim() ?? null,
      match: Number.parseFloat(entry?.match ?? '0'),
    }))
    .filter((entry) => entry.title && entry.artist);
}

/**
 * Parça bulunamazsa sanatçı benzerliğine düşer.
 */
export async function getSimilarArtists({ artist, limit = 10 }) {
  if (!artist) return [];

  const data = await call('artist.getSimilar', { artist, limit, autocorrect: 1 });
  const list = data?.similarartists?.artist;
  if (!Array.isArray(list)) return [];

  return list
    .map((entry) => entry?.name?.trim())
    .filter(Boolean);
}

/**
 * YouTube Radio mix URL'i üretir. Last.fm anahtarı olmadan da çalışan,
 * kimlik doğrulaması gerektirmeyen öneri kaynağıdır.
 * Lavalink `RD<videoId>` listesini "up next" olarak çözer.
 */
export function buildRadioMixUrl(track) {
  const uri = track?.info?.uri;
  const identifier = track?.info?.identifier;
  if (typeof uri !== 'string' || typeof identifier !== 'string') return null;
  if (!/youtube\.com|youtu\.be/.test(uri)) return null;
  // Canlı yayınlarda mix anlamlı değil.
  if (track?.info?.isStream) return null;
  return `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
}
